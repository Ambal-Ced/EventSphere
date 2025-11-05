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

    // Prepare queries
    const allTxQuery = buildDateFilter(
      db
        .from("transactions")
        .select("id, net_amount_cents, created_at, transaction_type, status, plan_name")
        .in("status", ["paid", "cancelled"])
        .in("transaction_type", ["purchase", "cancellation"])
    );

    const eventsQuery = buildDateFilter(
      db.from("events").select("id, created_at, date, category")
    );

    const profilesQuery = buildDateFilter(
      db.from("profiles").select("id, created_at")
    );

    const subsQuery = buildDateFilter(
      db
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
        `)
    );

    // Fetch all data in parallel for better performance
    const [allTxResult, eventsResult, profilesResult, subsResult, plansResult] = await Promise.all([
      allTxQuery,
      eventsQuery,
      profilesQuery,
      subsQuery,
      db.from("subscription_plans").select("id, name, price_cents").eq("is_active", true),
    ]);

    const { data: allTxRows, error: allTxError } = await allTxResult;
    if (allTxError) throw allTxError;
    
    const { data: eventsRows, error: eventsError } = await eventsResult;
    if (eventsError) throw eventsError;
    
    const { data: profilesRows, error: profilesError } = await profilesResult;
    if (profilesError) throw profilesError;
    
    const { data: subsRows, error: subsError } = await subsResult;
    if (subsError) throw subsError;
    
    const { data: plansRows, error: plansError } = await plansResult;
    if (plansError) throw plansError;

    // Separate paid and cancelled transactions
    const paidTxRows = (allTxRows ?? []).filter((t: any) => t.status === "paid" && t.transaction_type === "purchase");
    const cancelledTxRows = (allTxRows ?? []).filter((t: any) => t.status === "cancelled" && t.transaction_type === "cancellation");

    // Calculate revenue: Sum of all net_amount (paid + cancelled) - Sum of cancelled net_amount
    const totalAllRevenue = (allTxRows ?? []).reduce((sum: number, tx: any) => sum + (tx.net_amount_cents ?? 0), 0);
    const totalCancelledRevenue = (cancelledTxRows ?? []).reduce((sum: number, tx: any) => sum + (tx.net_amount_cents ?? 0), 0);
    const totalRevenue = Math.max(0, totalAllRevenue - totalCancelledRevenue);

    // Calculate revenue statistics from paid transactions (before subtracting cancelled)
    const paidRevenueValues = (paidTxRows ?? [])
      .map((r: any) => r.net_amount_cents ?? 0)
      .filter((v: number) => v > 0)
      .sort((a: number, b: number) => a - b);

    const revenueMean = paidRevenueValues.length > 0 ? totalRevenue / paidRevenueValues.length : 0;
    
    // Median (using paid transactions)
    let revenueMedian = 0;
    if (paidRevenueValues.length > 0) {
      const mid = Math.floor(paidRevenueValues.length / 2);
      revenueMedian = paidRevenueValues.length % 2 === 0
        ? (paidRevenueValues[mid - 1] + paidRevenueValues[mid]) / 2
        : paidRevenueValues[mid];
    }

    // Mode (most frequent value from paid transactions)
    const frequency: Record<number, number> = {};
    paidRevenueValues.forEach((v: number) => {
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

    // Process transactions (paid only for transaction count)
    (paidTxRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].transactions += 1;
      byDay[day].revenue_cents += r.net_amount_cents ?? 0;
    });

    // Subtract cancelled transactions from revenue
    (cancelledTxRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0 };
      byDay[day].revenue_cents -= r.net_amount_cents ?? 0;
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
      // Count active subscriptions - only paid plans (plan_id starting with 111 or 222), exclude free tier (000)
      const planId = r.plan_id || "";
      const isPaidPlan = planId.startsWith("111") || planId.startsWith("222");
      const now = new Date();
      const periodEnd = new Date(r.current_period_end);
      if (r.status === "active" && periodEnd > now && isPaidPlan) {
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

    // Calculate revenue per subscription plan (paid - cancelled)
    (paidTxRows ?? []).forEach((tx: any) => {
      const planName = tx.plan_name || "Unknown";
      if (subscriptionBreakdown[planName]) {
        subscriptionBreakdown[planName].revenue_cents += tx.net_amount_cents ?? 0;
      }
    });
    (cancelledTxRows ?? []).forEach((tx: any) => {
      const planName = tx.plan_name || "Unknown";
      if (subscriptionBreakdown[planName]) {
        subscriptionBreakdown[planName].revenue_cents -= tx.net_amount_cents ?? 0;
      }
    });

    // Active subscriptions count - only paid plans (plan_id starting with 111 or 222), exclude free tier (000)
    const now = new Date();
    const activeSubscriptions = (subsRows ?? []).filter((sub: any) => {
      const planId = sub.plan_id || "";
      const isPaidPlan = planId.startsWith("111") || planId.startsWith("222");
      const periodEnd = new Date(sub.current_period_end);
      return sub.status === "active" && periodEnd > now && isPaidPlan;
    }).length;

    // Cumulative users over time
    const cumulativeUsers: Record<string, number> = {};
    let cumUsers = 0;
    Object.keys(byDay).sort().forEach((day) => {
      cumUsers += byDay[day].users;
      cumulativeUsers[day] = cumUsers;
    });

    // User growth rate: default to relative growth vs users 7 days ago (handles prev=0 better)
    const sortedDays = Object.keys(byDay).sort();
    const last7Days = sortedDays.slice(-7);
    const last7Users = last7Days.reduce((sum, day) => sum + byDay[day].users, 0);
    // cumulative users up to 7 days ago
    let usersSevenDaysAgo = 0;
    if (sortedDays.length > 0) {
      const cutoffIndex = Math.max(0, sortedDays.length - 7 - 1);
      const cutoffDay = sortedDays[cutoffIndex];
      usersSevenDaysAgo = cumulativeUsers[cutoffDay] || 0;
    }
    const totalUsers = (profilesRows ?? []).length;
    const deltaUsers = Math.max(0, totalUsers - usersSevenDaysAgo);
    const userGrowthRate = usersSevenDaysAgo > 0
      ? (deltaUsers / usersSevenDaysAgo) * 100
      : (deltaUsers > 0 ? 100 : 0);

    // Conversion rate (active paid subscriptions / total users)
    const conversionRate = totalUsers > 0 ? (activeSubscriptions / totalUsers) * 100 : 0;

    // Calculate date range for rate calculations
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : new Date();
    const eventDates = (eventsRows ?? []).map((e: any) => new Date(e.created_at).getTime());
    const txDates = (allTxRows ?? []).map((t: any) => new Date(t.created_at).getTime());
    const allDates = [...eventDates, ...txDates, Date.now()];
    const actualStartDate = startDate || (allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Event creation rate (percentage of days with events created)
    const daysWithEvents = new Set((eventsRows ?? []).map((e: any) => new Date(e.created_at).toISOString().slice(0, 10))).size;
    const eventCreationRate = totalDays > 0 ? (daysWithEvents / totalDays) * 100 : 0;

    // Sales per event category (count events per category)
    const eventsByCategory: Record<string, number> = {};
    (eventsRows ?? []).forEach((e: any) => {
      const category = e.category || "Uncategorized";
      eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
    });
    const salesByCategory = Object.entries(eventsByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    // Most popular event category
    const mostPopularCategory = salesByCategory.length > 0 ? salesByCategory[0].category : "None";

    // Transaction rate (paid vs cancelled)
    const paidTransactions = paidTxRows.length;
    const cancelledTransactions = cancelledTxRows.length;
    const totalTransactionsForRate = paidTransactions + cancelledTransactions;
    const paidRate = totalTransactionsForRate > 0 ? (paidTransactions / totalTransactionsForRate) * 100 : 0;
    const cancelledRate = totalTransactionsForRate > 0 ? (cancelledTransactions / totalTransactionsForRate) * 100 : 0;

    return NextResponse.json({
      totals: {
        users: totalUsers,
        events: (eventsRows ?? []).length,
        transactions: paidTxRows.length,
        subscriptions: (subsRows ?? []).length,
        active_subscriptions: activeSubscriptions,
        revenue_cents: Math.max(0, totalRevenue), // Ensure revenue doesn't go negative
        currency: "PHP",
      },
      revenue_stats: {
        mean: revenueMean,
        median: revenueMedian,
        mode: revenueMode,
        total: Math.max(0, totalRevenue), // Ensure revenue doesn't go negative
        count: paidRevenueValues.length,
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
        avg_revenue_per_transaction: paidRevenueValues.length > 0 ? Math.max(0, totalRevenue) / paidRevenueValues.length : 0,
        avg_transactions_per_user: totalUsers > 0 ? paidTxRows.length / totalUsers : 0,
        event_creation_rate: eventCreationRate,
        transaction_paid_rate: paidRate,
        transaction_cancelled_rate: cancelledRate,
        most_popular_category: mostPopularCategory,
      },
      sales_by_category: salesByCategory,
      transaction_rates: {
        paid: paidTransactions,
        cancelled: cancelledTransactions,
        paid_rate: paidRate,
        cancelled_rate: cancelledRate,
      },
      debug: { usedServiceRole: !!serviceKey },
    });
  } catch (err: any) {
    console.error("/api/admin/analytics error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

