export const revalidate = 120; // cache API response for 2 minutes (ISR-style)
export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies(); // Await cookies in Next.js 15
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {}
          },
        },
      }
    );

    const { data: { session } } = await supabase.auth.getSession();
    let userId: string | null = session?.user?.id ?? null;
    if (!userId) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: u } = await client.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    }
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Admin check via RPC to bypass RLS (with fallback)
    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (adminCheckError) {
        console.error("Admin check RPC error:", adminCheckError);
        // Fallback to direct check if RPC is unavailable
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (e) {
      console.error("Admin check error:", e);
      // Fallback to direct check
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } catch (fallbackError) {
        console.error("Fallback admin check error:", fallbackError);
      }
    }
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Always use service role key for admin operations to bypass RLS
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }
    
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // Helper function to build date filter
    const buildDateFilter = (query: any) => {
      if (start) query = query.gte("created_at", start);
      if (end) query = query.lte("created_at", end);
      return query;
    };

    // Fetch user ratings data
    const ratingsQuery = buildDateFilter(
      db
        .from("user_ratings")
        .select("rating, suggestion, created_at, updated_at")
        .order("created_at", { ascending: false })
    );

    const { data: ratingsRows, error: ratingsError } = await ratingsQuery;
    if (ratingsError) {
      console.error("Error fetching ratings rows:", ratingsError);
      throw ratingsError;
    }

    // Fetch full ratings list with user info
    // First, fetch ratings without join
    const ratingsListQuery = buildDateFilter(
      db
        .from("user_ratings")
        .select("id, user_id, rating, suggestion, created_at, updated_at")
        .order("created_at", { ascending: false })
    );

    const { data: ratingsListData, error: ratingsListError } = await ratingsListQuery;
    
    if (ratingsListError) {
      console.error("Error fetching ratings list:", ratingsListError);
      throw ratingsListError;
    }

    const ratingsList = ratingsListData || [];
    
    // Get unique user IDs from ratings
    const userIds = [...new Set(ratingsList.map((item: any) => item.user_id).filter(Boolean))];
    
    // Fetch profiles for all users in one query
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profilesData, error: profilesError } = await db
        .from("profiles")
        .select("id, username, fname, lname, mname, suffix, email")
        .in("id", userIds);
      
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Continue without profiles if fetch fails
      } else {
        // Create a map of user_id -> profile
        (profilesData || []).forEach((profile: any) => {
          profilesMap[profile.id] = profile;
        });
      }
    }

    // Process data to create statistics
    const total = ratingsRows?.length || 0;
    
    // Rating Statistics (0-5 stars)
    const ratingCounts: Record<number, number> = {};
    let ratingsWithValue = 0;
    (ratingsRows || []).forEach((item: any) => {
      if (item.rating !== null && item.rating !== undefined) {
        const rating = Number(item.rating);
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        ratingsWithValue++;
      }
    });
    
    const ratingData = [0, 1, 2, 3, 4, 5].map((rating) => ({
      name: rating === 0 ? "No Rating" : `${rating} Star${rating !== 1 ? "s" : ""}`,
      value: ratingCounts[rating] || 0,
      count: ratingCounts[rating] || 0,
      percentage: total > 0 ? ((ratingCounts[rating] || 0) / total) * 100 : 0,
    }));

    // Calculate average rating and total stars sum
    let totalRatingSum = 0;
    let ratedCount = 0;
    (ratingsRows || []).forEach((item: any) => {
      if (item.rating !== null && item.rating !== undefined && item.rating > 0) {
        totalRatingSum += Number(item.rating);
        ratedCount++;
      }
    });
    const averageRating = ratedCount > 0 ? totalRatingSum / ratedCount : 0;
    const totalStars = totalRatingSum; // Sum of all stars
    
    // Calculate website rating percentage (average rating out of 5 stars converted to percentage)
    // Formula: (averageRating / 5) * 100
    const websiteRating = averageRating > 0 ? (averageRating / 5) * 100 : 0;

    // Suggestions statistics
    const withSuggestions = (ratingsRows || []).filter((item: any) => 
      item.suggestion && item.suggestion.trim().length > 0
    ).length;
    const withoutSuggestions = total - withSuggestions;

    const payload = {
      total, // Count of rating records (how many people rated)
      totalStars, // Sum of all stars
      rating: ratingData,
      averageRating: averageRating.toFixed(2),
      websiteRating: websiteRating.toFixed(1), // Website rating as percentage
      ratedCount,
      withSuggestions,
      withoutSuggestions,
      ratingsList: (ratingsList || []).map((item: any) => {
        // Get profile from the map we created
        const profile = item.user_id ? profilesMap[item.user_id] : null;
        
        // Construct user name
        let userName = "Unknown User";
        if (profile) {
          // Try to construct full name from fname, mname, lname, suffix
          const fullName = `${profile.fname || ""} ${profile.mname || ""} ${profile.lname || ""} ${profile.suffix || ""}`.trim();
          if (fullName) {
            userName = fullName;
          } else {
            // Fallback to username, then email
            userName = profile.username || profile.email || "Unknown User";
          }
        }
        
        return {
          id: item.id,
          user_id: item.user_id,
          rating: item.rating,
          suggestion: item.suggestion,
          created_at: item.created_at,
          updated_at: item.updated_at,
          user_name: userName,
          user_email: profile?.email || null,
        };
      }),
      debug: { usedServiceRole: true },
    };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (err: any) {
    console.error("/api/admin/ratings error", err);
    console.error("Error details:", {
      message: err.message,
      code: err.code,
      details: err.details,
      hint: err.hint,
      stack: err.stack,
    });
    return NextResponse.json({ 
      error: err.message ?? "Server error",
      details: process.env.NODE_ENV === "development" ? {
        code: err.code,
        details: err.details,
        hint: err.hint,
      } : undefined
    }, { status: 500 });
  }
}

