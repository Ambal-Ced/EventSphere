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

    // Try cookie session first; fallback to Bearer token
    const { data: { session } } = await supabase.auth.getSession();
    let userId: string | null = session?.user?.id ?? null;

    if (!userId) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const client = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: u } = await client.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { events, items, attStats } = body;

    if (!events || !Array.isArray(events)) {
      return NextResponse.json({ error: "Events data is required" }, { status: 400 });
    }

    // Calculate time series data from events
    const eventsByDate = new Map<string, {
      date: string;
      cost: number;
      revenue: number;
      events: number;
      expectedAttendees: number;
      actualAttendees: number;
    }>();

    events.forEach((ev: any) => {
      if (!ev.date) return;
      const dateStr = new Date(ev.date).toISOString().split('T')[0];
      const eventItems = items?.filter((i: any) => i.event_id === ev.id) || [];
      const totalCost = eventItems.reduce((sum: number, it: any) => 
        sum + ((it.cost || 0) * (it.item_quantity || 1)), 0);
      
      const markup = ev.markup_type === "percentage" 
        ? (totalCost * (ev.markup_value || 0) / 100) 
        : (ev.markup_value || 0);
      const priceAfterMarkup = totalCost + markup;
      const discount = ev.discount_type === "percentage" 
        ? (priceAfterMarkup * (ev.discount_value || 0) / 100) 
        : (ev.discount_type === "fixed" ? (ev.discount_value || 0) : 0);
      const finalRevenue = Math.max(0, priceAfterMarkup - discount);

      const att = attStats?.find((a: any) => a.event_id === ev.id);
      
      const existing = eventsByDate.get(dateStr) || {
        date: dateStr,
        cost: 0,
        revenue: 0,
        events: 0,
        expectedAttendees: 0,
        actualAttendees: 0,
      };

      existing.cost += totalCost;
      existing.revenue += finalRevenue;
      existing.events += 1;
      existing.expectedAttendees += att?.expected_attendees || 0;
      existing.actualAttendees += att?.event_attendees || 0;
      eventsByDate.set(dateStr, existing);
    });

    const timeSeries = Array.from(eventsByDate.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Calculate trends - use all available data if less than 30 days
    const dataToAnalyze = timeSeries.length > 0 ? timeSeries : [];
    
    // Determine data quality for accuracy warning
    let dataQuality = "good";
    let dataQualityMessage = "";
    
    if (dataToAnalyze.length === 0) {
      dataQuality = "none";
      dataQualityMessage = "No historical data available";
    } else if (dataToAnalyze.length < 7) {
      dataQuality = "low";
      dataQualityMessage = "Very limited historical data (less than 7 days)";
    } else if (dataToAnalyze.length < 30) {
      // Check for gaps in data
      const dateGaps = [];
      for (let i = 1; i < dataToAnalyze.length; i++) {
        const prevDate = new Date(dataToAnalyze[i - 1].date);
        const currDate = new Date(dataToAnalyze[i].date);
        const daysDiff = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff > 7) {
          dateGaps.push(daysDiff);
        }
      }
      
      if (dateGaps.length > dataToAnalyze.length * 0.3) {
        dataQuality = "inconsistent";
        dataQualityMessage = "Inconsistent historical data with significant gaps";
      } else {
        dataQuality = "moderate";
        dataQualityMessage = "Limited historical data (less than 30 days)";
      }
    }
    const avgDailyCost = dataToAnalyze.length > 0
      ? dataToAnalyze.reduce((sum, d) => sum + d.cost, 0) / dataToAnalyze.length
      : 0;
    const avgDailyRevenue = dataToAnalyze.length > 0
      ? dataToAnalyze.reduce((sum, d) => sum + d.revenue, 0) / dataToAnalyze.length
      : 0;
    const avgDailyEvents = dataToAnalyze.length > 0
      ? dataToAnalyze.reduce((sum, d) => sum + d.events, 0) / dataToAnalyze.length
      : 0;
    const avgDailyExpectedAttendees = dataToAnalyze.length > 0
      ? dataToAnalyze.reduce((sum, d) => sum + d.expectedAttendees, 0) / dataToAnalyze.length
      : 0;

    // Calculate growth rates - use simple average if less than 2 data points
    let costGrowth = 0;
    let revenueGrowth = 0;
    if (dataToAnalyze.length >= 2) {
      costGrowth = ((dataToAnalyze[dataToAnalyze.length - 1].cost - dataToAnalyze[0].cost) / Math.max(dataToAnalyze[0].cost || 1, 1)) * 100;
      revenueGrowth = ((dataToAnalyze[dataToAnalyze.length - 1].revenue - dataToAnalyze[0].revenue) / Math.max(dataToAnalyze[0].revenue || 1, 1)) * 100;
    } else if (dataToAnalyze.length === 1) {
      // If only one data point, assume stable (0% growth)
      costGrowth = 0;
      revenueGrowth = 0;
    }

    // Analyze popular categories and events
    const categoryCounts = new Map<string, number>();
    const eventPopularity = new Map<string, { name: string; cost: number; revenue: number; attendees: number }>();
    
    events.forEach((ev: any) => {
      // Count categories
      if (ev.category) {
        categoryCounts.set(ev.category, (categoryCounts.get(ev.category) || 0) + 1);
      }
      
      // Track event popularity
      const eventItems = items?.filter((i: any) => i.event_id === ev.id) || [];
      const totalCost = eventItems.reduce((sum: number, it: any) => 
        sum + ((it.cost || 0) * (it.item_quantity || 1)), 0);
      const markup = ev.markup_type === "percentage" 
        ? (totalCost * (ev.markup_value || 0) / 100) 
        : (ev.markup_value || 0);
      const priceAfterMarkup = totalCost + markup;
      const discount = ev.discount_type === "percentage" 
        ? (priceAfterMarkup * (ev.discount_value || 0) / 100) 
        : (ev.discount_type === "fixed" ? (ev.discount_value || 0) : 0);
      const finalRevenue = Math.max(0, priceAfterMarkup - discount);
      const att = attStats?.find((a: any) => a.event_id === ev.id);
      
      eventPopularity.set(ev.id, {
        name: ev.title || ev.id,
        cost: totalCost,
        revenue: finalRevenue,
        attendees: att?.expected_attendees || 0,
      });
    });

    // Get top categories
    const topCategories = Array.from(categoryCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    // Get most popular events (by revenue, then attendees)
    const popularEvents = Array.from(eventPopularity.values())
      .sort((a, b) => (b.revenue + b.attendees) - (a.revenue + a.attendees))
      .slice(0, 5);

    // Generate monthly predictions for next 6 months
    const predictions = [];
    const lastDate = dataToAnalyze.length > 0 
      ? new Date(dataToAnalyze[dataToAnalyze.length - 1].date)
      : new Date(); // Use today if no historical data
    
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
      
      // Convert daily averages to monthly totals
      const costPrediction = Math.max(0, avgDailyCost * daysInMonth * monthlyGrowthFactor);
      const revenuePrediction = Math.max(0, avgDailyRevenue * daysInMonth * monthlyGrowthFactor);
      const eventsPrediction = Math.max(0, Math.round(avgDailyEvents * daysInMonth * monthlyGrowthFactor));
      const expectedAttendeesPrediction = Math.max(0, Math.round(avgDailyExpectedAttendees * daysInMonth * monthlyGrowthFactor));

      predictions.push({
        date: `${year}-${month.toString().padStart(2, '0')}-01`,
        month: monthName,
        year: year,
        month_year: `${monthName} ${year}`,
        predicted_cost: costPrediction,
        predicted_revenue: revenuePrediction,
        predicted_events: eventsPrediction,
        predicted_expected_attendees: expectedAttendeesPrediction,
      });
    }

    // Predict next month's event count (first month prediction)
    const nextMonthEventCount = predictions.length > 0 ? predictions[0].predicted_events : Math.round(avgDailyEvents * 30 * (1 + (revenueGrowth / 100)));

    const response = NextResponse.json({
      predictions,
      trends: {
        avg_daily_cost: avgDailyCost,
        avg_daily_revenue: avgDailyRevenue,
        avg_daily_events: avgDailyEvents,
        avg_daily_expected_attendees: avgDailyExpectedAttendees,
        cost_growth_rate: costGrowth,
        revenue_growth_rate: revenueGrowth,
      },
      predictions_summary: {
        next_month_event_count: nextMonthEventCount,
        next_month_estimated_revenue: predictions.length > 0 ? predictions[0].predicted_revenue : avgDailyRevenue * 30 * (1 + (revenueGrowth / 100)),
        next_month_estimated_cost: predictions.length > 0 ? predictions[0].predicted_cost : avgDailyCost * 30 * (1 + (costGrowth / 100)),
        next_6_months_total_events: predictions.reduce((sum, p) => sum + p.predicted_events, 0),
        next_6_months_total_revenue: predictions.reduce((sum, p) => sum + p.predicted_revenue, 0),
        next_6_months_total_cost: predictions.reduce((sum, p) => sum + p.predicted_cost, 0),
      },
      popular_insights: {
        top_categories: topCategories,
        popular_events: popularEvents,
        predicted_popular_category: topCategories.length > 0 ? topCategories[0].category : null,
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
    console.error("Error in POST /api/analytics/predictions:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

