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

    // Fetch feedback data for analytics (include all statuses)
    const feedbackQuery = buildDateFilter(
      db
        .from("feedback")
        .select("feedback_type, rating, status, priority, created_at")
        .order("created_at", { ascending: false })
    );

    const { data: feedbackRows, error: feedbackError } = await feedbackQuery;
    if (feedbackError) throw feedbackError;

    // Fetch full feedback list for the detailed view
    const feedbackListQuery = buildDateFilter(
      db
        .from("feedback")
        .select("id, title, description, feedback_type, rating, status, priority, admin_notes, created_at, updated_at")
        .order("created_at", { ascending: false })
    );

    const { data: feedbackList, error: feedbackListError } = await feedbackListQuery;
    if (feedbackListError) throw feedbackListError;

    // Process data to create statistics
    const total = feedbackRows?.length || 0;
    
    // Feedback Type Statistics
    const feedbackTypeCounts: Record<string, number> = {};
    (feedbackRows || []).forEach((item: any) => {
      const type = item.feedback_type || "unknown";
      feedbackTypeCounts[type] = (feedbackTypeCounts[type] || 0) + 1;
    });
    const feedbackTypeData = Object.entries(feedbackTypeCounts)
      .map(([name, count]) => ({
        name: name.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
        value: count,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Rating Statistics
    const ratingCounts: Record<number, number> = {};
    let ratingsWithValue = 0;
    (feedbackRows || []).forEach((item: any) => {
      if (item.rating !== null && item.rating !== undefined) {
        const rating = Number(item.rating);
        ratingCounts[rating] = (ratingCounts[rating] || 0) + 1;
        ratingsWithValue++;
      }
    });
    const ratingData = [1, 2, 3, 4, 5].map((rating) => ({
      name: `${rating} Star${rating !== 1 ? "s" : ""}`,
      value: ratingCounts[rating] || 0,
      count: ratingCounts[rating] || 0,
      percentage: ratingsWithValue > 0 ? ((ratingCounts[rating] || 0) / ratingsWithValue) * 100 : 0,
    }));

    // Status Statistics
    const statusCounts: Record<string, number> = {};
    (feedbackRows || []).forEach((item: any) => {
      const status = item.status || "unknown";
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    const statusData = Object.entries(statusCounts)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: count,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    // Priority Statistics
    const priorityCounts: Record<string, number> = {};
    (feedbackRows || []).forEach((item: any) => {
      const priority = item.priority || "unknown";
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });
    const priorityData = Object.entries(priorityCounts)
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value: count,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => {
        const order: Record<string, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
        return (order[b.name.toLowerCase()] || 0) - (order[a.name.toLowerCase()] || 0);
      });

    const payload = {
      total,
      feedbackType: feedbackTypeData,
      rating: ratingData,
      status: statusData,
      priority: priorityData,
      ratingsWithValue,
      feedbackList: feedbackList || [],
      debug: { usedServiceRole: !!serviceKey },
    };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (err: any) {
    console.error("/api/admin/feedback error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

