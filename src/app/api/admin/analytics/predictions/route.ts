export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 60;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
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

    // Admin check
    const { data: isAdmin } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const db = serviceKey
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
      : supabase;

    const body = await request.json();
    const { time_series, totals, additional_metrics } = body;

    if (!time_series || !Array.isArray(time_series)) {
      return NextResponse.json({ error: "Time series data is required" }, { status: 400 });
    }

    // Aggregate time series by month for better trend analysis
    const monthlyData = new Map<string, {
      date: string;
      revenue_cents: number;
      users: number;
      transactions: number;
      events: number;
    }>();

    time_series.forEach((d: any) => {
      if (!d.date) return;
      const date = new Date(d.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const existing = monthlyData.get(monthKey) || {
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`,
        revenue_cents: 0,
        users: 0,
        transactions: 0,
        events: 0,
      };
      existing.revenue_cents += d.revenue_cents || 0;
      existing.users += d.users || 0;
      existing.transactions += d.transactions || 0;
      existing.events += d.events || 0;
      monthlyData.set(monthKey, existing);
    });

    const monthlySeries = Array.from(monthlyData.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate trends from monthly data
    const dataToAnalyze = monthlySeries.length > 0 ? monthlySeries : time_series;
    const lastDataPoints = dataToAnalyze.slice(-6); // Last 6 months or last 30 days
    
    // Determine data quality for accuracy warning
    let dataQuality = "good";
    let dataQualityMessage = "";
    
    if (dataToAnalyze.length === 0) {
      dataQuality = "none";
      dataQualityMessage = "No historical data available";
    } else if (dataToAnalyze.length < 2) {
      dataQuality = "low";
      dataQualityMessage = "Very limited historical data (less than 2 months)";
    } else if (dataToAnalyze.length < 6) {
      // Check for gaps in monthly data
      const dateGaps = [];
      for (let i = 1; i < dataToAnalyze.length; i++) {
        const prevDate = new Date(dataToAnalyze[i - 1].date);
        const currDate = new Date(dataToAnalyze[i].date);
        const monthsDiff = (currDate.getFullYear() - prevDate.getFullYear()) * 12 + (currDate.getMonth() - prevDate.getMonth());
        if (monthsDiff > 2) {
          dateGaps.push(monthsDiff);
        }
      }
      
      if (dateGaps.length > dataToAnalyze.length * 0.3) {
        dataQuality = "inconsistent";
        dataQualityMessage = "Inconsistent historical data with significant gaps";
      } else {
        dataQuality = "moderate";
        dataQualityMessage = "Limited historical data (less than 6 months)";
      }
    }
    
    const avgMonthlyRevenue = lastDataPoints.length > 0
      ? lastDataPoints.reduce((sum: number, d: any) => sum + (d.revenue_cents || 0), 0) / lastDataPoints.length
      : 0;
    const avgMonthlyUsers = lastDataPoints.length > 0
      ? lastDataPoints.reduce((sum: number, d: any) => sum + (d.users || 0), 0) / lastDataPoints.length
      : 0;
    const avgMonthlyTransactions = lastDataPoints.length > 0
      ? lastDataPoints.reduce((sum: number, d: any) => sum + (d.transactions || 0), 0) / lastDataPoints.length
      : 0;
    const avgMonthlyEvents = lastDataPoints.length > 0
      ? lastDataPoints.reduce((sum: number, d: any) => sum + (d.events || 0), 0) / lastDataPoints.length
      : 0;

    // Calculate growth rates
    let revenueGrowth = 0;
    let userGrowth = 0;
    if (lastDataPoints.length >= 2) {
      revenueGrowth = ((lastDataPoints[lastDataPoints.length - 1].revenue_cents || 0) - (lastDataPoints[0].revenue_cents || 0)) / Math.max(lastDataPoints[0].revenue_cents || 1, 1) * 100;
      userGrowth = ((lastDataPoints[lastDataPoints.length - 1].users || 0) - (lastDataPoints[0].users || 0)) / Math.max(lastDataPoints[0].users || 1, 1) * 100;
    }

    // Generate monthly predictions for next 6 months
    const predictions = [];
    const lastDate = dataToAnalyze.length > 0 
      ? new Date(dataToAnalyze[dataToAnalyze.length - 1].date)
      : new Date();
    
    // Start from next month
    const startMonth = new Date(lastDate);
    startMonth.setMonth(startMonth.getMonth() + 1);
    startMonth.setDate(1); // First day of the month
    
    for (let i = 0; i < 6; i++) {
      const predictionMonth = new Date(startMonth);
      predictionMonth.setMonth(startMonth.getMonth() + i);
      
      const year = predictionMonth.getFullYear();
      const month = predictionMonth.getMonth() + 1;
      const monthName = predictionMonth.toLocaleString('default', { month: 'long' });
      const daysInMonth = new Date(year, month, 0).getDate();
      
      // Calculate monthly growth factor (compound growth)
      const monthlyGrowthFactor = dataToAnalyze.length > 0 ? Math.pow(1 + (revenueGrowth / 100), i + 1) : 1;
      
      // Convert monthly averages to monthly totals with growth
      const revenuePrediction = Math.max(0, Math.round(avgMonthlyRevenue * monthlyGrowthFactor));
      const usersPrediction = Math.max(0, Math.round(avgMonthlyUsers * monthlyGrowthFactor));
      const transactionsPrediction = Math.max(0, Math.round(avgMonthlyTransactions * monthlyGrowthFactor));
      const eventsPrediction = Math.max(0, Math.round(avgMonthlyEvents * monthlyGrowthFactor));

      predictions.push({
        date: `${year}-${month.toString().padStart(2, '0')}-01`,
        month: monthName,
        year: year,
        month_year: `${monthName} ${year}`,
        predicted_revenue_cents: revenuePrediction,
        predicted_users: usersPrediction,
        predicted_transactions: transactionsPrediction,
        predicted_events: eventsPrediction,
      });
    }

    // Predict next month's totals
    const nextMonthPrediction = predictions.length > 0 ? predictions[0] : null;

    const response = NextResponse.json({
      predictions,
      trends: {
        avg_monthly_revenue: avgMonthlyRevenue,
        avg_monthly_users: avgMonthlyUsers,
        avg_monthly_transactions: avgMonthlyTransactions,
        avg_monthly_events: avgMonthlyEvents,
        revenue_growth_rate: revenueGrowth,
        user_growth_rate: userGrowth,
      },
      predictions_summary: {
        next_month_revenue: nextMonthPrediction?.predicted_revenue_cents || 0,
        next_month_users: nextMonthPrediction?.predicted_users || 0,
        next_month_transactions: nextMonthPrediction?.predicted_transactions || 0,
        next_month_events: nextMonthPrediction?.predicted_events || 0,
        next_6_months_total_revenue: predictions.reduce((sum, p) => sum + (p.predicted_revenue_cents || 0), 0),
        next_6_months_total_users: predictions.reduce((sum, p) => sum + (p.predicted_users || 0), 0),
        next_6_months_total_transactions: predictions.reduce((sum, p) => sum + (p.predicted_transactions || 0), 0),
        next_6_months_total_events: predictions.reduce((sum, p) => sum + (p.predicted_events || 0), 0),
      },
      data_quality: {
        quality: dataQuality,
        message: dataQualityMessage,
        data_points: dataToAnalyze.length,
        has_low_accuracy: dataQuality !== "good",
      },
    });
    
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    console.error("Error in POST /api/admin/analytics/predictions:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

