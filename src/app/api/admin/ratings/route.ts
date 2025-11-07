export const revalidate = 120; // cache API response for 2 minutes (ISR-style)
export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
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

    // Admin check via RPC to bypass RLS
    const { data: isAdmin } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const admin = serviceKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : null as any;
    const db: any = admin ?? supabase;

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
    if (ratingsError) throw ratingsError;

    // Fetch full ratings list with user info
    const ratingsListQuery = buildDateFilter(
      db
        .from("user_ratings")
        .select(`
          id,
          user_id,
          rating,
          suggestion,
          created_at,
          updated_at,
          profiles:user_id (
            id,
            full_name,
            email
          )
        `)
        .order("created_at", { ascending: false })
    );

    const { data: ratingsList, error: ratingsListError } = await ratingsListQuery;
    if (ratingsListError) throw ratingsListError;

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

    // Calculate average rating
    let totalRatingSum = 0;
    let ratedCount = 0;
    (ratingsRows || []).forEach((item: any) => {
      if (item.rating !== null && item.rating !== undefined && item.rating > 0) {
        totalRatingSum += Number(item.rating);
        ratedCount++;
      }
    });
    const averageRating = ratedCount > 0 ? totalRatingSum / ratedCount : 0;

    // Suggestions statistics
    const withSuggestions = (ratingsRows || []).filter((item: any) => 
      item.suggestion && item.suggestion.trim().length > 0
    ).length;
    const withoutSuggestions = total - withSuggestions;

    const payload = {
      total,
      rating: ratingData,
      averageRating: averageRating.toFixed(2),
      ratedCount,
      withSuggestions,
      withoutSuggestions,
      ratingsList: (ratingsList || []).map((item: any) => ({
        id: item.id,
        user_id: item.user_id,
        rating: item.rating,
        suggestion: item.suggestion,
        created_at: item.created_at,
        updated_at: item.updated_at,
        user_name: item.profiles?.full_name || item.profiles?.email || "Unknown User",
        user_email: item.profiles?.email || null,
      })),
      debug: { usedServiceRole: !!serviceKey },
    };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (err: any) {
    console.error("/api/admin/ratings error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

