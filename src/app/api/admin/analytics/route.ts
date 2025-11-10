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

    // Prepare queries (narrowed columns to reduce transfer)
    // Use overall_transaction instead of transactions to avoid deleted data
    const paidTxQuery = buildDateFilter(
      db
        .from("overall_transaction")
        .select("id, net_amount_cents, created_at, plan_name, subscription_id")
        .eq("status", "paid")
        .eq("transaction_type", "purchase")
    );

    const cancelledTxQuery = buildDateFilter(
      db
        .from("overall_transaction")
        .select("id, net_amount_cents, created_at, plan_name, subscription_id")
        .eq("status", "cancelled")
        .eq("transaction_type", "cancellation")
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
    const [paidTxResult, cancelledTxResult, eventsResult, profilesResult, subsResult, plansResult] = await Promise.all([
      paidTxQuery,
      cancelledTxQuery,
      eventsQuery,
      profilesQuery,
      subsQuery,
      db.from("subscription_plans").select("id, name, price_cents").eq("is_active", true),
    ]);

    const { data: paidTxRows, error: paidErr } = await paidTxResult;
    if (paidErr) throw paidErr;
    const { data: cancelledTxRows, error: cancelledErr } = await cancelledTxResult;
    if (cancelledErr) throw cancelledErr;
    
    const { data: eventsRows, error: eventsError } = await eventsResult;
    if (eventsError) throw eventsError;
    
    const { data: profilesRows, error: profilesError } = await profilesResult;
    if (profilesError) throw profilesError;
    
    const { data: subsRows, error: subsError } = await subsResult;
    if (subsError) throw subsError;
    
    const { data: plansRows, error: plansError } = await plansResult;
    if (plansError) throw plansError;

    // Calculate revenue: [(sum of all paid + sum of all cancelled) - (sum of all cancelled)]
    // Formula: (totalpaid + totalcancelled) - totalcancelled = totalpaid - totalcancelled
    // Example: (159 + 300) - 159 = 300
    const totalAllRevenue = (paidTxRows ?? []).reduce((sum: number, tx: any) => sum + (tx.net_amount_cents ?? 0), 0);
    const totalCancelledRevenue = (cancelledTxRows ?? []).reduce((sum: number, tx: any) => sum + (tx.net_amount_cents ?? 0), 0);
    // Formula: [(totalpaid + totalcancelled) - totalcancelled] = totalpaid - totalcancelled
    const totalRevenue = Math.max(0, totalAllRevenue - totalCancelledRevenue);

    // Calculate revenue statistics from paid transactions only (for mean/median/mode)
    const paidRevenueValues = (paidTxRows ?? [])
      .map((r: any) => r.net_amount_cents ?? 0)
      .filter((v: number) => v > 0)
      .sort((a: number, b: number) => a - b);

    // Mean should be calculated from paid transactions only, not from net revenue
    const revenueMean = paidRevenueValues.length > 0 ? totalAllRevenue / paidRevenueValues.length : 0;
    
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
      small_event_org_transactions: number;
      large_event_org_transactions: number;
    }> = {};

    // Process events
    (eventsRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
      byDay[day].events += 1;
    });

    // Process transactions (paid only for transaction count)
    // First, count all paid transactions by plan and by day
    // Also create a map to track paid transactions by subscription_id for matching cancellations
    const paidTxBySubscription: Map<string, { day: string; planName: string }> = new Map();
    
    (paidTxRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
      byDay[day].transactions += 1;
      byDay[day].revenue_cents += r.net_amount_cents ?? 0;
      
      // Count all paid transactions by plan (even if they might be cancelled later)
      const planName = r.plan_name || "";
      if (planName.includes("Small Event Org") && !planName.includes("Cancelled")) {
        byDay[day].small_event_org_transactions += 1;
        // Store for matching cancellations
        if (r.subscription_id) {
          paidTxBySubscription.set(r.subscription_id, { day, planName: "Small Event Org" });
        }
      } else if (planName.includes("Large Event Org") && !planName.includes("Cancelled")) {
        byDay[day].large_event_org_transactions += 1;
        // Store for matching cancellations
        if (r.subscription_id) {
          paidTxBySubscription.set(r.subscription_id, { day, planName: "Large Event Org" });
        }
      }
    });
    
    // Then, subtract cancelled transactions from the daily counts
    // Logic: (total paid + total cancelled) - total cancelled = total paid - total cancelled
    // Match cancelled transactions to their original paid transaction date
    (cancelledTxRows ?? []).forEach((r: any) => {
      // Extract plan name from cancelled transaction (e.g., "Cancelled Small Event Org" -> "Small Event Org")
      const planName = r.plan_name || "";
      let targetDay: string | null = null;
      let targetPlan: string | null = null;
      
      // Try to match by subscription_id first
      if (r.subscription_id && paidTxBySubscription.has(r.subscription_id)) {
        const paidTx = paidTxBySubscription.get(r.subscription_id)!;
        targetDay = paidTx.day;
        targetPlan = paidTx.planName;
      } else {
        // Fallback: use cancellation date if we can't match
        targetDay = new Date(r.created_at).toISOString().slice(0, 10);
        if (planName.includes("Small Event Org")) {
          targetPlan = "Small Event Org";
        } else if (planName.includes("Large Event Org")) {
          targetPlan = "Large Event Org";
        }
      }
      
      if (targetDay && targetPlan) {
        if (!byDay[targetDay]) byDay[targetDay] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
        
        // Subtract from the appropriate plan count
        if (targetPlan === "Small Event Org") {
          byDay[targetDay].small_event_org_transactions = Math.max(0, (byDay[targetDay].small_event_org_transactions || 0) - 1);
        } else if (targetPlan === "Large Event Org") {
          byDay[targetDay].large_event_org_transactions = Math.max(0, (byDay[targetDay].large_event_org_transactions || 0) - 1);
        }
      }
    });

    // Subtract cancelled transactions from revenue using formula: [(paid + cancelled) - cancelled]
    // Formula: (paid + cancelled) - cancelled = paid - cancelled
    (cancelledTxRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
      // Formula: [(paid + cancelled) - cancelled] = paid - cancelled
      byDay[day].revenue_cents = Math.max(0, (byDay[day].revenue_cents || 0) - (r.net_amount_cents ?? 0));
    });

    // Process users
    (profilesRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
      byDay[day].users += 1;
    });

    // Process subscriptions
    (subsRows ?? []).forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { events: 0, transactions: 0, revenue_cents: 0, users: 0, subscriptions: 0, active_subscriptions: 0, small_event_org_transactions: 0, large_event_org_transactions: 0 };
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
    // Exclude trialing subscriptions from paid plans, add them to "Trial Subscriber" category
    const subscriptionBreakdown: Record<string, { name: string; count: number; revenue_cents: number }> = {};
    
    // Initialize "Trial Subscriber" category
    subscriptionBreakdown["Trial Subscriber"] = { name: "Trial Subscriber", count: 0, revenue_cents: 0 };
    
    (subsRows ?? []).forEach((sub: any) => {
      const planName = (sub.subscription_plans as any)?.name || "Unknown";
      const status = sub.status || "";
      
      // If subscription is trialing, add to Trial Subscriber category
      if (status === "trialing") {
        subscriptionBreakdown["Trial Subscriber"].count += 1;
        return; // Skip adding to the plan's count
      }
      
      // For non-trialing subscriptions, add to their plan category
      if (!subscriptionBreakdown[planName]) {
        subscriptionBreakdown[planName] = { name: planName, count: 0, revenue_cents: 0 };
      }
      subscriptionBreakdown[planName].count += 1;
    });

    // Calculate revenue per subscription plan: [(sum of all paid + sum of all cancelled) - (sum of all cancelled)]
    // Formula: (totalpaid + totalcancelled) - totalcancelled = totalpaid - totalcancelled
    // Note: Trial Subscriber category should not have revenue (trialing subscriptions don't generate transactions)
    (paidTxRows ?? []).forEach((tx: any) => {
      const planName = tx.plan_name || "Unknown";
      // Skip revenue calculation for "Trial Subscriber" category
      if (subscriptionBreakdown[planName] && planName !== "Trial Subscriber") {
        subscriptionBreakdown[planName].revenue_cents += tx.net_amount_cents ?? 0;
      }
    });
    (cancelledTxRows ?? []).forEach((tx: any) => {
      const planName = tx.plan_name || "Unknown";
      // Skip revenue calculation for "Trial Subscriber" category
      if (subscriptionBreakdown[planName] && planName !== "Trial Subscriber") {
        // Formula: [(paid + cancelled) - cancelled] = paid - cancelled
        subscriptionBreakdown[planName].revenue_cents = Math.max(0, (subscriptionBreakdown[planName].revenue_cents || 0) - (tx.net_amount_cents ?? 0));
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
    const txDates = (paidTxRows ?? []).map((t: any) => new Date(t.created_at).getTime());
    const allDates = [...eventDates, ...txDates, Date.now()];
    const actualStartDate = startDate || (allDates.length > 0 ? new Date(Math.min(...allDates)) : new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000));
    const totalDays = Math.max(1, Math.ceil((endDate.getTime() - actualStartDate.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    // Event creation rate (percentage of days with events created)
    const daysWithEvents = new Set((eventsRows ?? []).map((e: any) => new Date(e.created_at).toISOString().slice(0, 10))).size;
    const eventCreationRate = totalDays > 0 ? (daysWithEvents / totalDays) * 100 : 0;

    // Popular events by category (count events per category)
    const eventsByCategory: Record<string, number> = {};
    (eventsRows ?? []).forEach((e: any) => {
      const category = e.category || "Uncategorized";
      eventsByCategory[category] = (eventsByCategory[category] || 0) + 1;
    });
    const popularEventsByCategory = Object.entries(eventsByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => a.category.localeCompare(b.category)); // Sort by name alphabetically

    // Most popular event category (by count, for insights)
    const mostPopularCategory = Object.entries(eventsByCategory)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)[0]?.category || "None";

    // Transaction rate (paid vs cancelled)
    const paidTransactions = (paidTxRows ?? []).length;
    const cancelledTransactions = (cancelledTxRows ?? []).length;
    const totalTransactionsForRate = paidTransactions + cancelledTransactions;
    const paidRate = totalTransactionsForRate > 0 ? (paidTransactions / totalTransactionsForRate) * 100 : 0;
    const cancelledRate = totalTransactionsForRate > 0 ? (cancelledTransactions / totalTransactionsForRate) * 100 : 0;

    const payload = {
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
          revenue_cents: Math.max(0, v.revenue_cents || 0), // Ensure revenue never goes negative
          users: v.users,
          subscriptions: v.subscriptions,
          active_subscriptions: v.active_subscriptions,
          cumulative_users: cumulativeUsers[date] || 0,
          small_event_org_transactions: v.small_event_org_transactions || 0,
          large_event_org_transactions: v.large_event_org_transactions || 0,
        })),
      subscription_breakdown: Object.values(subscriptionBreakdown)
        .filter(item => item.count > 0) // Only include categories with subscribers
        .sort((a, b) => {
          // Sort: Trial Subscriber first, then by count descending
          if (a.name === "Trial Subscriber") return -1;
          if (b.name === "Trial Subscriber") return 1;
          return b.count - a.count;
        }),
      additional_metrics: {
        user_growth_rate: userGrowthRate,
        conversion_rate: conversionRate,
        avg_revenue_per_transaction: paidRevenueValues.length > 0 ? totalAllRevenue / paidRevenueValues.length : 0,
        avg_transactions_per_user: totalUsers > 0 ? paidTxRows.length / totalUsers : 0,
        event_creation_rate: eventCreationRate,
        transaction_paid_rate: paidRate,
        transaction_cancelled_rate: cancelledRate,
        most_popular_category: mostPopularCategory,
      },
      popular_events_by_category: popularEventsByCategory,
      transaction_rates: {
        paid: paidTransactions,
        cancelled: cancelledTransactions,
        paid_rate: paidRate,
        cancelled_rate: cancelledRate,
      },
      debug: { usedServiceRole: !!serviceKey },
    };

    const res = NextResponse.json(payload);
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (err: any) {
    console.error("/api/admin/analytics error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

