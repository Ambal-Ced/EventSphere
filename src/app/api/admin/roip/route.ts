export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 60; // Revalidate every 60 seconds

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
    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (adminCheckError) {
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .single();
      isAdmin = profile?.account_type === "admin";
    }
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }
    
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Get transaction data from overall_transaction
    const { data: transactions, error: txError } = await db
      .from("overall_transaction")
      .select("net_amount_cents, created_at, status, transaction_type")
      .eq("status", "paid")
      .eq("transaction_type", "purchase")
      .order("created_at", { ascending: true });

    if (txError) {
      console.error("Error fetching transactions:", txError);
      return NextResponse.json({ error: "Failed to fetch transaction data" }, { status: 500 });
    }

    // Get admin costs
    const { data: costs, error: costsError } = await db
      .from("admin_costs")
      .select("amount_cents, date_incurred, cost_type")
      .order("date_incurred", { ascending: true });

    if (costsError) {
      console.error("Error fetching costs:", costsError);
    }

    // Calculate historical revenue by month
    const revenueByMonth: { [key: string]: number } = {};
    (transactions || []).forEach((tx: any) => {
      const date = new Date(tx.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth[monthKey] = (revenueByMonth[monthKey] || 0) + (tx.net_amount_cents || 0);
    });

    // Calculate costs by month
    const costsByMonth: { [key: string]: number } = {};
    (costs || []).forEach((cost: any) => {
      const date = new Date(cost.date_incurred);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      costsByMonth[monthKey] = (costsByMonth[monthKey] || 0) + (cost.amount_cents || 0);
    });

    // Prepare data for Cohere prediction
    const historicalData = Object.keys(revenueByMonth)
      .sort()
      .slice(-12) // Last 12 months
      .map(month => ({
        month,
        revenue: revenueByMonth[month],
        costs: costsByMonth[month] || 0,
        net: revenueByMonth[month] - (costsByMonth[month] || 0),
      }));

    const totalRevenue = (transactions || []).reduce((sum: number, tx: any) => sum + (tx.net_amount_cents || 0), 0);
    const totalCosts = (costs || []).reduce((sum: number, cost: any) => sum + (cost.amount_cents || 0), 0);
    const currentROI = totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0;

    // Use Cohere API for prediction
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      // Fallback to simple trend-based prediction if Cohere is not available
      const avgMonthlyRevenue = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length
        : 0;
      const avgMonthlyCosts = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.costs, 0) / historicalData.length
        : 0;

      // Simple linear projection for next 6 months
      const predictions = [];
      const lastMonth = historicalData[historicalData.length - 1];
      for (let i = 1; i <= 6; i++) {
        const futureMonth = new Date();
        futureMonth.setMonth(futureMonth.getMonth() + i);
        const monthKey = `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, '0')}`;
        predictions.push({
          month: monthKey,
          predicted_revenue: Math.max(0, Math.round(avgMonthlyRevenue * (1 + (i * 0.02)))), // 2% growth per month
          predicted_costs: Math.round(avgMonthlyCosts),
          predicted_roi: avgMonthlyRevenue > 0
            ? ((avgMonthlyRevenue * (1 + (i * 0.02)) - avgMonthlyCosts) / (avgMonthlyRevenue * (1 + (i * 0.02)))) * 100
            : 0,
        });
      }

      const response = NextResponse.json({
        historical: historicalData,
        predictions,
        current_roi: currentROI,
        total_revenue: totalRevenue,
        total_costs: totalCosts,
        net_income: totalRevenue - totalCosts,
        method: "trend_based",
      });
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return response;
    }

    // Use Cohere for AI-powered prediction
    const prompt = `You are a financial analyst. Based on the following historical revenue and cost data, predict the Return on Investment (ROI) for the next 6 months.

Historical Data (last 12 months):
${historicalData.map(d => `Month: ${d.month}, Revenue: ₱${(d.revenue / 100).toFixed(2)}, Costs: ₱${(d.costs / 100).toFixed(2)}, Net: ₱${(d.net / 100).toFixed(2)}`).join('\n')}

Current Total Revenue: ₱${(totalRevenue / 100).toFixed(2)}
Current Total Costs: ₱${(totalCosts / 100).toFixed(2)}
Current ROI: ${currentROI.toFixed(2)}%

Please provide predictions for the next 6 months in JSON format:
{
  "predictions": [
    {
      "month": "YYYY-MM",
      "predicted_revenue": number (in cents),
      "predicted_costs": number (in cents),
      "predicted_roi": number (percentage)
    }
  ],
  "analysis": "brief explanation of trends and predictions"
}

Only return valid JSON, no other text.`;

    const cohereResponse = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        message: prompt,
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!cohereResponse.ok) {
      const errorText = await cohereResponse.text();
      console.error("Cohere API error:", errorText);
      // Fallback to trend-based prediction
      const avgMonthlyRevenue = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length
        : 0;
      const avgMonthlyCosts = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.costs, 0) / historicalData.length
        : 0;

      const predictions = [];
      for (let i = 1; i <= 6; i++) {
        const futureMonth = new Date();
        futureMonth.setMonth(futureMonth.getMonth() + i);
        const monthKey = `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, '0')}`;
        predictions.push({
          month: monthKey,
          predicted_revenue: Math.max(0, Math.round(avgMonthlyRevenue * (1 + (i * 0.02)))),
          predicted_costs: Math.round(avgMonthlyCosts),
          predicted_roi: avgMonthlyRevenue > 0
            ? ((avgMonthlyRevenue * (1 + (i * 0.02)) - avgMonthlyCosts) / (avgMonthlyRevenue * (1 + (i * 0.02)))) * 100
            : 0,
        });
      }

      const response = NextResponse.json({
        historical: historicalData,
        predictions,
        current_roi: currentROI,
        total_revenue: totalRevenue,
        total_costs: totalCosts,
        net_income: totalRevenue - totalCosts,
        method: "trend_based_fallback",
      });
      response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
      return response;
    }

    const cohereData = await cohereResponse.json();
    let predictionText = cohereData?.text || cohereData?.message?.content?.[0]?.text || "";

    // Try to extract JSON from the response
    let predictions = [];
    let analysis = "";
    
    try {
      // Look for JSON in the response
      const jsonMatch = predictionText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        predictions = parsed.predictions || [];
        analysis = parsed.analysis || "";
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse Cohere response, using trend-based fallback:", parseError);
      // Fallback to trend-based prediction
      const avgMonthlyRevenue = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.revenue, 0) / historicalData.length
        : 0;
      const avgMonthlyCosts = historicalData.length > 0
        ? historicalData.reduce((sum, d) => sum + d.costs, 0) / historicalData.length
        : 0;

      for (let i = 1; i <= 6; i++) {
        const futureMonth = new Date();
        futureMonth.setMonth(futureMonth.getMonth() + i);
        const monthKey = `${futureMonth.getFullYear()}-${String(futureMonth.getMonth() + 1).padStart(2, '0')}`;
        predictions.push({
          month: monthKey,
          predicted_revenue: Math.max(0, Math.round(avgMonthlyRevenue * (1 + (i * 0.02)))),
          predicted_costs: Math.round(avgMonthlyCosts),
          predicted_roi: avgMonthlyRevenue > 0
            ? ((avgMonthlyRevenue * (1 + (i * 0.02)) - avgMonthlyCosts) / (avgMonthlyRevenue * (1 + (i * 0.02)))) * 100
            : 0,
        });
      }
    }

    const response = NextResponse.json({
      historical: historicalData,
      predictions,
      analysis,
      current_roi: currentROI,
      total_revenue: totalRevenue,
      total_costs: totalCosts,
      net_income: totalRevenue - totalCosts,
      method: "cohere_ai",
    });
    response.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return response;
  } catch (error: any) {
    console.error("Error in POST /api/admin/roip:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

