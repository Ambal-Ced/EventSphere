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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", session.user.id)
      .single();

    if (profileError || profile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    // Use service role to bypass RLS for admin analytics
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build date filters
    const txFilter: any[] = [];
    if (start) txFilter.push({ col: "created_at", op: ">=", val: start });
    if (end) txFilter.push({ col: "created_at", op: "<=", val: end });

    // Counts
    const [profilesCount, eventsCount, collabCount] = await Promise.all([
      admin.from("profiles").select("id", { count: "exact", head: true }),
      admin.from("events").select("id", { count: "exact", head: true }),
      admin.from("event_collaborator").select("id", { count: "exact", head: true }),
    ]);

    // Transactions metrics
    let txQuery = admin
      .from("transactions")
      .select("id, net_amount_cents, created_at, transaction_type, status")
      .eq("status", "paid")
      .eq("transaction_type", "purchase");
    if (start) txQuery = txQuery.gte("created_at", start);
    if (end) txQuery = txQuery.lte("created_at", end);
    const { data: txRows, error: txError } = await txQuery;
    if (txError) throw txError;

    const totalRevenueCents = (txRows ?? []).reduce((sum, r: any) => sum + (r.net_amount_cents ?? 0), 0);
    const totalTransactions = txRows?.length ?? 0;

    // Group by day for simple timeseries
    const byDay: Record<string, { revenue_cents: number; count: number }> = {};
    for (const r of txRows ?? []) {
      const day = new Date(r.created_at).toISOString().slice(0, 10);
      if (!byDay[day]) byDay[day] = { revenue_cents: 0, count: 0 };
      byDay[day].revenue_cents += r.net_amount_cents ?? 0;
      byDay[day].count += 1;
    }

    return NextResponse.json({
      totals: {
        profiles: profilesCount.count ?? 0,
        events: eventsCount.count ?? 0,
        collaborations: collabCount.count ?? 0,
        transactions: totalTransactions,
        revenue_cents: totalRevenueCents,
        currency: "PHP",
      },
      series: Object.entries(byDay)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, revenue_cents: v.revenue_cents, transactions: v.count })),
    });
  } catch (err: any) {
    console.error("/api/admin/stats error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


