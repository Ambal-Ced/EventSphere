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

    // 1. Get all transactions (paid purchases only)
    let txQuery = db
      .from("transactions")
      .select("id, net_amount_cents, created_at, transaction_type, status, plan_name")
      .eq("status", "paid")
      .eq("transaction_type", "purchase");
    txQuery = buildDateFilter(txQuery);
    const { data: txRows, error: txError } = await txQuery;
    if (txError) throw txError;

    // 2. Get all events
    let eventsQuery = db.from("events").select("id, created_at, date");
    eventsQuery = buildDateFilter(eventsQuery);
    const { data: eventsRows, error: eventsError } = await eventsQuery;
    if (eventsError) throw eventsError;

    // 3. Get all profiles (users)
    let profilesQuery = db.from("profiles").select("id, created_at");
    profilesQuery = buildDateFilter(profilesQuery);
    const { data: profilesRows, error: profilesError } = await profilesQuery;
    if (profilesError) throw profilesError;

    // 4. Get all subscriptions with plan details
    let subsQuery = db
      .from("user_subscriptions")
      .select(`
        id,
        user_id,
        plan_id,
        status,
        created_at,
        current_period_start,
        current_period_end,
        subscription_plans (
          id,
          name,
          price_cents
        )
      `);
    subsQuery = buildDateFilter(subsQuery);
    const { data: subsRows, error: subsError } = await subsQuery;
    if (subsError) throw subsError;

    // 5. Get subscription plans for reference
    const { data: plansRows, error: plansError } = await db
      .from("subscription_plans")
      .select("id, name, price_cents")
      .eq("is_active", true);
    if (plansError) throw plansError;

    // Calculate revenue statistics
    const revenueValues = (txRows ?? [])
      .map((r: any) => r.net_amount_cents ?? 0)
      .filter((v: number) => v > 0)
      .sort((a: number, b: number) => a - b);

    const totalRevenue = revenueValues.reduce((sum: number, v: number) => sum + v, 0);
    const revenueMean = revenueValues.length > 0 ? totalRevenue / revenueValues.length : 0;
    
    // Median
    let revenueMedian = 0;
    if (revenueValues.length > 0) {
      const mid = Math.floor(revenueValues.length / 2);
      revenueMedian = revenueValues.length % 2 === 0
        ? (revenueValues[mid - 1] + revenueValues[mid]) / 2
        : revenueValues[mid];
    }

    // Mode (most frequent value)
    const frequency: Record<number, number> = {};
    revenueValues.forEach((v: number) => {
      frequency[v] = (frequency[v] || 0) + 1;
    });
    const maxFreq = Math.max(...Object.values(frequency));
    const revenueMode = Object.keys(frequency).find(
      (k) => frequency[Number(k)] === maxFreq
    ) ? Number(Object.keys(frequency).find((k) => frequency[Number(k)] === maxFreq)) : 0;

    // Group by day for time series
    const byDay: Record<string, {
      events: number;
      transactions: number;
      revenue_cents: number;
      users: number;
      subscriptions: number;
      active_subscriptions: number;
    }> = {};

    // Process events
    (eventsRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].events += 1;
    });

    // Process transactions
    (txRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].transactions += 1;
      byDay[day].revenue_cents += r.net_amount_cents ?? 0;
    });

    // Process users
    (profilesRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].users += 1;
    });

    // Process subscriptions
    (subsRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].subscriptions += 1;
      // Count active subscriptions
      const now = new Date();
      const periodEnd = new Date(r.current_period_end);
      if (r.status === "active" && periodEnd > now) {
        byDay[day].active_subscriptions += 1;
      }
    });

    // Subscription breakdown by plan
    const subscriptionBreakdown: Record<string, { name: string; count: number; revenue_cents: number }> = {};
    (subsRows ?? []).forEach((sub: any) => {
      const planName = (sub.subscription_plans as any)?.name || "Unknown";
      if (!subscriptionBreakdown[planName]) {
        subscriptionBreakdown[planName] = { name: planName, count: 0, revenue_cents: 0 };
      }
      subscriptionBreakdown[planName].count += 1;
    });

    // Calculate revenue per subscription plan
    (txRows ?? []).forEach((tx: any) => {
      const planName = tx.plan_name || "Unknown";
      if (subscriptionBreakdown[planName]) {
        subscriptionBreakdown[planName].revenue_cents += tx.net_amount_cents ?? 0;
      }
    });

    // Active subscriptions count
    const now = new Date();
    const activeSubscriptions = (subsRows ?? []).filter((sub: any) => {
      const periodEnd = new Date(sub.current_period_end);
      return sub.status === "active" && periodEnd > now;
    }).length;

    // Cumulative users over time
    const cumulativeUsers: Record<string, number> = {};
    let cumUsers = 0;
    Object.keys(byDay).sort().forEach((day) => {
      cumUsers += byDay[day].users;
      cumulativeUsers[day] = cumUsers;
    });

    // User growth rate (compare last 7 days vs previous 7 days)
    const sortedDays = Object.keys(byDay).sort();
    const last7Days = sortedDays.slice(-7);
    const prev7Days = sortedDays.slice(-14, -7);
    const last7Users = last7Days.reduce((sum, day) => sum + byDay[day].users, 0);
    const prev7Users = prev7Days.reduce((sum, day) => sum + byDay[day].users, 0);
    const userGrowthRate = prev7Users > 0 ? ((last7Users - prev7Users) / prev7Users) * 100 : 0;

    // Conversion rate (users with subscriptions / total users)
    const totalUsers = (profilesRows ?? []).length;
    const usersWithSubscriptions = new Set((subsRows ?? []).map((s: any) => s.user_id)).size;
    const conversionRate = totalUsers > 0 ? (usersWithSubscriptions / totalUsers) * 100 : 0;

    return NextResponse.json({
      totals: {
        users: totalUsers,
        events: (eventsRows ?? []).length,
        transactions: (txRows ?? []).length,
        subscriptions: (subsRows ?? []).length,
        active_subscriptions: activeSubscriptions,
        revenue_cents: totalRevenue,
        currency: "PHP",
      },
      revenue_stats: {
        mean: revenueMean,
        median: revenueMedian,
        mode: revenueMode,
        total: totalRevenue,
        count: revenueValues.length,
      },
      time_series: Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({
          date,
          events: v.events,
          transactions: v.transactions,
          revenue_cents: v.revenue_cents,
          users: v.users,
          subscriptions: v.subscriptions,
          active_subscriptions: v.active_subscriptions,
          cumulative_users: cumulativeUsers[date] || 0,
        })),
      subscription_breakdown: Object.values(subscriptionBreakdown).sort((a, b) => b.count - a.count),
      additional_metrics: {
        user_growth_rate: userGrowthRate,
        conversion_rate: conversionRate,
        avg_revenue_per_transaction: revenueValues.length > 0 ? totalRevenue / revenueValues.length : 0,
        avg_transactions_per_user: totalUsers > 0 ? (txRows ?? []).length / totalUsers : 0,
      },
      debug: { usedServiceRole: !!serviceKey },
    });
  } catch (err: any) {
    console.error("/api/admin/analytics error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

