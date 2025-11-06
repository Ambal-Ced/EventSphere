"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
// Lazy-load heavy Recharts components (client-only)
const loadingBox = (h:number=300) => <div style={{height:h}} className="w-full animate-pulse rounded bg-muted/20"/>;
const ResponsiveContainer: any = dynamic(() => import("recharts").then(m => m.ResponsiveContainer as any), { ssr: false, loading: () => loadingBox() }) as any;
const LineChart: any = dynamic(() => import("recharts").then(m => m.LineChart as any), { ssr: false, loading: () => null }) as any;
const Line: any = dynamic(() => import("recharts").then(m => m.Line as any), { ssr: false, loading: () => null }) as any;
const BarChart: any = dynamic(() => import("recharts").then(m => m.BarChart as any), { ssr: false, loading: () => null }) as any;
const Bar: any = dynamic(() => import("recharts").then(m => m.Bar as any), { ssr: false, loading: () => null }) as any;
const PieChart: any = dynamic(() => import("recharts").then(m => m.PieChart as any), { ssr: false, loading: () => loadingBox() }) as any;
const Pie: any = dynamic(() => import("recharts").then(m => m.Pie as any), { ssr: false, loading: () => null }) as any;
const Cell: any = dynamic(() => import("recharts").then(m => m.Cell as any), { ssr: false, loading: () => null }) as any;
const XAxis: any = dynamic(() => import("recharts").then(m => m.XAxis as any), { ssr: false, loading: () => null }) as any;
const YAxis: any = dynamic(() => import("recharts").then(m => m.YAxis as any), { ssr: false, loading: () => null }) as any;
const CartesianGrid: any = dynamic(() => import("recharts").then(m => m.CartesianGrid as any), { ssr: false, loading: () => null }) as any;
const Tooltip: any = dynamic(() => import("recharts").then(m => m.Tooltip as any), { ssr: false, loading: () => null }) as any;
const Legend: any = dynamic(() => import("recharts").then(m => m.Legend as any), { ssr: false, loading: () => null }) as any;
import { TrendingUp, Users, Calendar, DollarSign, Package, Activity, RefreshCw, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "account_review">("eventtria");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all" | "custom">("30d");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [aiGeneratedInsight, setAiGeneratedInsight] = useState<string | null>(null);

  // Helpers are declared before usage to avoid temporal dead zone issues in hooks
  function formatCurrency(cents: number) {
    return `₱${(cents / 100).toFixed(2)}`;
  }
  function formatNumber(num: number) {
    return num.toLocaleString();
  }

  const descriptiveSummary = useMemo(() => {
    if (!analyticsData) return "";
    const totals = analyticsData.totals || {};
    const metrics = analyticsData.additional_metrics || {};
    const transactionRates = analyticsData.transaction_rates || {};
    const parts: string[] = [];
    parts.push(
      `Users: ${Number(totals.users || 0).toLocaleString()}. ` +
      `Events: ${Number(totals.events || 0).toLocaleString()}. ` +
      `Transactions: ${Number(totals.transactions || 0).toLocaleString()}. ` +
      `Revenue: ${formatCurrency(totals.revenue_cents || 0)}.`
    );
    if (typeof metrics.conversion_rate === "number") {
      parts.push(`Conversion rate: ${metrics.conversion_rate.toFixed(1)}%.`);
    }
    if (typeof metrics.avg_revenue_per_transaction === "number") {
      parts.push(`Avg transaction: ${formatCurrency(metrics.avg_revenue_per_transaction)}.`);
    }
    if (typeof metrics.user_growth_rate === "number") {
      parts.push(`User growth: ${metrics.user_growth_rate.toFixed(1)}%.`);
    }
    if (typeof metrics.event_creation_rate === "number") {
      parts.push(`Event creation days: ${metrics.event_creation_rate.toFixed(1)}%.`);
    }
    if (typeof transactionRates.paid_rate === "number" && typeof transactionRates.cancelled_rate === "number") {
      parts.push(`Transactions paid: ${transactionRates.paid_rate.toFixed(1)}%; cancelled: ${transactionRates.cancelled_rate.toFixed(1)}%.`);
    }
    if (metrics.most_popular_category && metrics.most_popular_category !== "None") {
      parts.push(`Top category: ${metrics.most_popular_category}.`);
    }
    return parts.join(" ");
  }, [analyticsData]);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);

  // Watchdog: auto-refresh if analytics load is stuck too long
  useEffect(() => {
    if (loadingAnalytics && !analyticsData) {
      const id = setTimeout(() => { try { window.location.reload(); } catch {} }, 30000);
      return () => clearTimeout(id);
    }
  }, [loadingAnalytics, analyticsData]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", session.user.id)
          .single();
        if (!cancelled) {
          setIsAdmin((data?.account_type as string | undefined) === "admin");
        }
        if (error) {
          console.warn("Admin page: failed to fetch account_type:", error);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchAnalytics = useCallback(async () => {
    setLoadingAnalytics(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Calculate date range
      let startDate: string | null = null;
      let endDate: string | null = null;
      
      if (dateRange === "custom") {
        if (customStartDate) {
          startDate = customStartDate.toISOString();
        }
        if (customEndDate) {
          endDate = new Date(customEndDate.getTime() + 24 * 60 * 60 * 1000 - 1).toISOString(); // End of day
        }
      } else if (dateRange !== "all") {
        const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
        const date = new Date();
        date.setDate(date.getDate() - days);
        startDate = date.toISOString();
      }

      const url = new URL("/api/admin/analytics", window.location.origin);
      if (startDate) url.searchParams.set("start", startDate);
      if (endDate) url.searchParams.set("end", endDate);

      const res = await fetch(url.toString(), {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const json = await res.json();
      if (res.ok) {
        setAnalyticsData(json);
      } else {
        console.error("Failed to fetch analytics:", json);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (isAdmin) {
      // Small delay to debounce rapid changes
      const timeoutId = setTimeout(() => {
        fetchAnalytics();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, dateRange, customStartDate, customEndDate, fetchAnalytics]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-semibold">404</div>
          <div className="text-muted-foreground">This page could not be found.</div>
        </div>
      </div>
    );
  }

  

  const generateInsights = (data: any) => {
    const insights: Array<{ type: "success" | "warning" | "info" | "neutral"; title: string; description: string }> = [];

    if (!data) return insights;

    const totals = data.totals || {};
    const metrics = data.additional_metrics || {};
    const revenueStats = data.revenue_stats || {};
    const transactionRates = data.transaction_rates || {};

    // User Growth Insight
    if (metrics.user_growth_rate !== undefined) {
      if (metrics.user_growth_rate > 10) {
        insights.push({
          type: "success",
          title: "Strong User Growth",
          description: `Your platform is experiencing excellent growth with a ${metrics.user_growth_rate.toFixed(1)}% increase in new users over the past week. This is a positive sign of platform adoption.`,
        });
      } else if (metrics.user_growth_rate < 0) {
        insights.push({
          type: "warning",
          title: "Declining User Growth",
          description: `User growth has decreased by ${Math.abs(metrics.user_growth_rate).toFixed(1)}% in the past week. Consider reviewing your marketing strategies or user acquisition channels.`,
        });
      } else {
        insights.push({
          type: "info",
          title: "Stable User Base",
          description: `User growth remains stable with ${metrics.user_growth_rate.toFixed(1)}% growth. Your platform maintains consistent user acquisition.`,
        });
      }
    }

    // Conversion Rate Insight
    if (metrics.conversion_rate !== undefined) {
      if (metrics.conversion_rate >= 50) {
        insights.push({
          type: "success",
          title: "Excellent Conversion Rate",
          description: `${metrics.conversion_rate.toFixed(1)}% of your users have active paid subscriptions. This indicates strong product-market fit and effective monetization.`,
        });
      } else if (metrics.conversion_rate >= 20) {
        insights.push({
          type: "info",
          title: "Moderate Conversion Rate",
          description: `${metrics.conversion_rate.toFixed(1)}% of users have active subscriptions. There's room for improvement through targeted marketing or subscription incentives.`,
        });
      } else {
        insights.push({
          type: "warning",
          title: "Low Conversion Rate",
          description: `Only ${metrics.conversion_rate.toFixed(1)}% of users have active subscriptions. Consider improving your value proposition or offering free trial periods to increase conversions.`,
        });
      }
    }

    // Revenue Insight
    if (totals.revenue_cents > 0) {
      const revenueInPesos = totals.revenue_cents / 100;
      const avgRevenue = metrics.avg_revenue_per_transaction || 0;
      
      insights.push({
        type: "success",
        title: "Revenue Performance",
        description: `Your platform has generated ${formatCurrency(totals.revenue_cents)} in total revenue with an average transaction value of ${formatCurrency(avgRevenue)}. This shows healthy monetization.`,
      });

      // Revenue consistency
      if (revenueStats.median && revenueStats.mean) {
        const variation = Math.abs(revenueStats.mean - revenueStats.median) / revenueStats.mean;
        if (variation < 0.2) {
          insights.push({
            type: "info",
            title: "Consistent Revenue Patterns",
            description: `Your revenue shows consistent transaction values (median: ${formatCurrency(revenueStats.median)}, mean: ${formatCurrency(revenueStats.mean)}), indicating stable pricing and customer behavior.`,
          });
        }
      }
    }

    // Event Creation Rate Insight
    if (metrics.event_creation_rate !== undefined) {
      if (metrics.event_creation_rate >= 70) {
        insights.push({
          type: "success",
          title: "High Event Activity",
          description: `Events are being created on ${metrics.event_creation_rate.toFixed(1)}% of days in the selected period, showing strong user engagement and platform utilization.`,
        });
      } else if (metrics.event_creation_rate < 30) {
        insights.push({
          type: "warning",
          title: "Low Event Activity",
          description: `Events are only created on ${metrics.event_creation_rate.toFixed(1)}% of days. Consider promoting event creation features or offering incentives to increase activity.`,
        });
      } else {
        insights.push({
          type: "info",
          title: "Moderate Event Activity",
          description: `Events are created on ${metrics.event_creation_rate.toFixed(1)}% of days, indicating regular but not constant platform usage.`,
        });
      }
    }

    // Transaction Success Rate Insight
    if (transactionRates.paid_rate !== undefined && transactionRates.cancelled_rate !== undefined) {
      if (transactionRates.paid_rate >= 80) {
        insights.push({
          type: "success",
          title: "High Transaction Success Rate",
          description: `${transactionRates.paid_rate.toFixed(1)}% of transactions are successful (paid), with only ${transactionRates.cancelled_rate.toFixed(1)}% being cancelled. This indicates strong customer satisfaction and retention.`,
        });
      } else if (transactionRates.cancelled_rate > 30) {
        insights.push({
          type: "warning",
          title: "High Cancellation Rate",
          description: `${transactionRates.cancelled_rate.toFixed(1)}% of transactions are being cancelled. Consider reviewing your payment process, pricing strategy, or customer support to reduce cancellations.`,
        });
      }
    }

    // Most Popular Category Insight
    if (metrics.most_popular_category && metrics.most_popular_category !== "None") {
      insights.push({
        type: "info",
        title: "Category Preference",
        description: `"${metrics.most_popular_category}" is the most popular event category. Consider highlighting this category or creating targeted marketing campaigns around it.`,
      });
    }

    // Active Subscriptions Insight
    if (totals.active_subscriptions !== undefined && totals.users !== undefined) {
      const subscriptionPenetration = totals.users > 0 ? (totals.active_subscriptions / totals.users) * 100 : 0;
      if (subscriptionPenetration >= 50) {
        insights.push({
          type: "success",
          title: "Strong Subscription Adoption",
          description: `${totals.active_subscriptions} out of ${totals.users} users (${subscriptionPenetration.toFixed(1)}%) have active paid subscriptions. This demonstrates strong platform value.`,
        });
      } else if (subscriptionPenetration < 20) {
        insights.push({
          type: "warning",
          title: "Low Subscription Adoption",
          description: `Only ${totals.active_subscriptions} out of ${totals.users} users (${subscriptionPenetration.toFixed(1)}%) have active subscriptions. Focus on converting free users to paid plans.`,
        });
      }
    }

    // Transaction Volume Insight
    if (totals.transactions !== undefined && totals.users !== undefined) {
      const transactionsPerUser = totals.users > 0 ? totals.transactions / totals.users : 0;
      if (transactionsPerUser >= 2) {
        insights.push({
          type: "success",
          title: "High Transaction Frequency",
          description: `On average, each user makes ${transactionsPerUser.toFixed(1)} transactions, indicating strong customer loyalty and repeat business.`,
        });
      } else if (transactionsPerUser < 1) {
        insights.push({
          type: "info",
          title: "Transaction Opportunity",
          description: `Currently, there are ${totals.transactions} transactions across ${totals.users} users. Consider strategies to encourage repeat purchases or subscriptions.`,
        });
      }
    }

    return insights;
  };

  const generateAIInsight = async () => {
    if (!analyticsData || isGeneratingInsight) return;

    setIsGeneratingInsight(true);
    setAiGeneratedInsight(null);

    try {
      // Build a concise, executive-style paragraph locally using available metrics
      const totals = analyticsData.totals || {};
      const metrics = analyticsData.additional_metrics || {};
      const revenueStats = analyticsData.revenue_stats || {};
      const txRates = analyticsData.transaction_rates || {};
      const topCategory = metrics.most_popular_category && metrics.most_popular_category !== "None"
        ? metrics.most_popular_category
        : null;

      const users = Number(totals.users || 0);
      const events = Number(totals.events || 0);
      const transactions = Number(totals.transactions || 0);
      const revenueCents = Number(totals.revenue_cents || 0);
      const revenuePeso = `₱${(revenueCents / 100).toFixed(2)}`;
      const growth = typeof metrics.user_growth_rate === "number" ? `${metrics.user_growth_rate.toFixed(1)}%` : "0%";
      const conv = typeof metrics.conversion_rate === "number" ? `${metrics.conversion_rate.toFixed(1)}%` : "0%";
      const avgTx = typeof metrics.avg_revenue_per_transaction === "number" ? `₱${(metrics.avg_revenue_per_transaction / 100).toFixed(2)}` : "₱0.00";
      const mean = typeof revenueStats.mean === "number" ? `₱${(revenueStats.mean / 100).toFixed(2)}` : null;
      const paidRate = typeof txRates.paid_rate === "number" ? `${txRates.paid_rate.toFixed(1)}%` : null;
      const cancelledRate = typeof txRates.cancelled_rate === "number" ? `${txRates.cancelled_rate.toFixed(1)}%` : null;

      // Professional, explanatory narrative
      const parts: string[] = [];
      parts.push(`Your platform currently has ${users.toLocaleString()} users across ${events.toLocaleString()} events, generating ${transactions.toLocaleString()} total transactions.`);
      parts.push(`Revenue totals ${revenuePeso}; the typical purchase is around ${avgTx}${mean ? `, closely aligned with a mean of ${mean}` : ""}, suggesting pricing consistency.`);
      parts.push(`User growth over the most recent period is ${growth}, while subscription conversion is ${conv}. Together, these indicate the present balance between acquisition and monetization.`);
      if (paidRate || cancelledRate) {
        parts.push(`Of recent transactions, ${paidRate ? `${paidRate} were paid` : ""}${paidRate && cancelledRate ? ", and " : paidRate ? "." : ""}${cancelledRate ? `${cancelledRate} were cancelled` : ""}${!cancelledRate ? "." : "."}`);
      }
      if (topCategory) {
        parts.push(`"${topCategory}" is the most engaged category; highlighting it in discovery and campaigns can compound performance.`);
      }
      parts.push(`Operationally, focus on sustaining user growth, improving conversion through onboarding and offers, and reducing cancellations by addressing any checkout or value-perception friction.`);

      const paragraph = parts.join(" ");
      setAiGeneratedInsight(paragraph);

      // Persist the generated insight for auditability
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        try {
          await supabase.from("admin_insights").insert({
            user_id: session.user.id,
            content: paragraph,
            context: analyticsData,
          });
        } catch (e) {
          console.warn("Failed to save admin insight:", e);
        }
      }
    } catch (error: any) {
      console.error("Error generating AI insight:", error);
      setAiGeneratedInsight("Failed to generate insight locally.");
    } finally {
      setIsGeneratingInsight(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive analytics and insights</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => {
              const value = e.target.value as "7d" | "30d" | "90d" | "all" | "custom";
              setDateRange(value);
              if (value !== "custom") {
                setShowCustomDatePicker(false);
              }
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
            <option value="custom">Custom range</option>
          </select>
          {dateRange === "custom" && (
            <Popover open={showCustomDatePicker} onOpenChange={setShowCustomDatePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="border-input bg-background text-foreground">
                  <Calendar className="h-4 w-4 mr-2" />
                  Custom Dates
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-4" align="end">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <DatePicker
                      date={customStartDate}
                      setDate={setCustomStartDate}
                      placeholder="Select start date"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <DatePicker
                      date={customEndDate}
                      setDate={setCustomEndDate}
                      placeholder="Select end date"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        if (customStartDate && customEndDate) {
                          setShowCustomDatePicker(false);
                          // fetchAnalytics will be called by useEffect when customStartDate/customEndDate changes
                        }
                      }}
                      size="sm"
                      className="flex-1"
                      disabled={!customStartDate || !customEndDate}
                    >
                      Apply
                    </Button>
                    <Button
                      onClick={() => {
                        setCustomStartDate(undefined);
                        setCustomEndDate(undefined);
                      }}
                      variant="outline"
                      size="sm"
                    >
                      Clear
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button onClick={fetchAnalytics} disabled={loadingAnalytics} variant="outline" size="sm" className="border-input bg-background text-foreground">
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingAnalytics ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab("eventtria")}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "eventtria"
                ? "bg-background border-b-2 border-primary text-primary"
                : "hover:text-primary text-muted-foreground"
            }`}
          >
            EventTria
          </button>
          <button
            onClick={() => setActiveTab("feedback")}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "feedback"
                ? "bg-background border-b-2 border-primary text-primary"
                : "hover:text-primary text-muted-foreground"
            }`}
          >
            Feedback
          </button>
          <button
            onClick={() => setActiveTab("account_review")}
            className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
              activeTab === "account_review"
                ? "bg-background border-b-2 border-primary text-primary"
                : "hover:text-primary text-muted-foreground"
            }`}
          >
            Account Review
          </button>
        </div>
      </div>

      {activeTab === "eventtria" && (
        <div className="space-y-6">
          {loadingAnalytics && !analyticsData ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <div>Loading analytics...</div>
              </div>
            </div>
          ) : analyticsData ? (
            <div className={loadingAnalytics ? "opacity-50 pointer-events-none" : ""}>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Users</div>
                    <Users className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">{formatNumber(analyticsData.totals?.users || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {analyticsData.additional_metrics?.user_growth_rate !== undefined && (
                      <span className={analyticsData.additional_metrics.user_growth_rate >= 0 ? "text-green-600" : "text-red-600"}>
                        {analyticsData.additional_metrics.user_growth_rate >= 0 ? "+" : ""}
                        {analyticsData.additional_metrics.user_growth_rate.toFixed(1)}% growth
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Events</div>
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">{formatNumber(analyticsData.totals?.events || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">Events created</div>
                </div>

                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Transactions</div>
                    <Activity className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">{formatNumber(analyticsData.totals?.transactions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {analyticsData.additional_metrics?.avg_transactions_per_user !== undefined && (
                      <span>{analyticsData.additional_metrics.avg_transactions_per_user.toFixed(2)} per user</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Revenue</div>
                    <DollarSign className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">
                    {formatCurrency(analyticsData.totals?.revenue_cents || 0)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {analyticsData.additional_metrics?.avg_revenue_per_transaction !== undefined && (
                      <span>Avg: {formatCurrency(analyticsData.additional_metrics.avg_revenue_per_transaction)}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Subscription Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Active Subscriptions</div>
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">{formatNumber(analyticsData.totals?.active_subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    of {formatNumber(analyticsData.totals?.users || 0)} users
                  </div>
                </div>

                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Conversion Rate</div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">
                    {analyticsData.additional_metrics?.conversion_rate !== undefined
                      ? `${analyticsData.additional_metrics.conversion_rate.toFixed(1)}%`
                      : "0%"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Users with subscriptions</div>
                </div>

                <div className="rounded-lg border p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium text-muted-foreground">Total Subscriptions</div>
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="text-3xl font-bold">{formatNumber(analyticsData.totals?.subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">All subscription records</div>
                </div>
              </div>

              {/* Revenue Statistics */}
              <div className="rounded-lg border p-6 bg-card">
                <h3 className="text-lg font-semibold mb-4">Revenue Statistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Mean (Average)</div>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mean || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Average transaction value</div>
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Median</div>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.median || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Middle value</div>
                  </div>
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <div className="text-sm text-muted-foreground mb-1">Mode (Most Common)</div>
                    <div className="text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mode || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Most frequent amount</div>
                  </div>
                </div>
              </div>

              {/* Time Series Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Events Over Time */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Events Created Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="events" stroke="#3b82f6" strokeWidth={2} name="Events" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Transactions Over Time */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Transactions Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="transactions" stroke="#10b981" strokeWidth={2} name="Transactions" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue Over Time */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Revenue Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} tickFormatter={(value: unknown) => `₱${(Number(value as number) / 100).toFixed(0)}`} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="revenue_cents" stroke="#f59e0b" strokeWidth={2} name="Revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* User Growth Over Time */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">User Growth Over Time</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="cumulative_users" stroke="#8b5cf6" strokeWidth={2} name="Total Users" />
                      <Line type="monotone" dataKey="users" stroke="#ec4899" strokeWidth={2} name="New Users" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subscription Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Most Popular Subscriptions */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Most Popular Subscriptions</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(analyticsData.subscription_breakdown || []).map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Bar dataKey="count" name="Subscribers" shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const idx = payload?._index ?? 0;
                        return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                      }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue by Subscription Plan */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Revenue by Subscription Plan</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(analyticsData.subscription_breakdown || []).map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} tickFormatter={(value: unknown) => `₱${(Number(value as number) / 100).toFixed(0)}`} />
                      <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Bar dataKey="revenue_cents" name="Revenue" shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const idx = payload?._index ?? 0;
                        return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                      }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subscription Distribution Pie Chart */}
              {analyticsData.subscription_breakdown && analyticsData.subscription_breakdown.length > 0 && (
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Subscription Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={analyticsData.subscription_breakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(props: any) => {
                          const { name, percent } = props;
                          return `${name}: ${(percent * 100).toFixed(0)}%`;
                        }}
                        outerRadius={100}
                        dataKey="count"
                        labelStyle={{ fill: '#1e293b', fontSize: '12px', fontWeight: 500 }}
                      >
                        {analyticsData.subscription_breakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Event Creation Rate & Transaction Rates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Event Creation Rate */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Event Creation Rate</h3>
                  <div className="flex items-center justify-center mb-4">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-primary">
                        {analyticsData.additional_metrics?.event_creation_rate !== undefined
                          ? `${analyticsData.additional_metrics.event_creation_rate.toFixed(1)}%`
                          : "0%"}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        Days with events created in selected period
                      </div>
                    </div>
                  </div>
                  {analyticsData.sales_by_category && analyticsData.sales_by_category.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium mb-3">Category Rankings</div>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {analyticsData.sales_by_category.map((item: any, index: number) => (
                          <div
                            key={item.category}
                            className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary">
                                {index + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{item.category}</div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 text-sm font-semibold ml-2">
                              {item.count}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Transaction Rates */}
                {analyticsData.transaction_rates && (
                  <div className="rounded-lg border p-6 bg-card">
                    <h3 className="text-lg font-semibold mb-4">Transaction Rates</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={[
                            { name: "Paid", value: analyticsData.transaction_rates.paid_rate || 0 },
                            { name: "Cancelled", value: analyticsData.transaction_rates.cancelled_rate || 0 },
                          ]}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(props: any) => {
                            const { name, percent } = props;
                            return `${name}: ${(percent * 100).toFixed(1)}%`;
                          }}
                          outerRadius={100}
                          dataKey="value"
                          labelStyle={{ fill: '#1e293b', fontSize: '12px', fontWeight: 500 }}
                        >
                          <Cell fill={COLORS[1]} /> {/* Paid - green */
                          <Cell fill={COLORS[3]} /> {/* Cancelled - red */}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                      <div>
                        <div className="text-2xl font-bold text-green-600">
                          {analyticsData.transaction_rates.paid || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Paid</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-red-600">
                          {analyticsData.transaction_rates.cancelled || 0}
                        </div>
                        <div className="text-xs text-muted-foreground">Cancelled</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Sales by Event Category */}
              {analyticsData.sales_by_category && analyticsData.sales_by_category.length > 0 && (
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Sales by Event Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.sales_by_category.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="category" className="text-xs" angle={-45} textAnchor="end" height={100} tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Bar dataKey="count" name="Events" shape={(props: any) => {
                        const { x, y, width, height, payload } = props;
                        const idx = payload?._index ?? 0;
                        return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                      }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* AI Insight + Descriptive Summary */}
              <div className="rounded-lg border p-6 bg-card">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">AI Insight</h3>
                  </div>
                  <Button
                    onClick={generateAIInsight}
                    disabled={isGeneratingInsight || !analyticsData}
                    variant="outline"
                    size="sm"
                    className="border-input bg-background text-foreground"
                  >
                    {isGeneratingInsight ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Lightbulb className="h-4 w-4 mr-2" />
                        Generate AI Insight
                      </>
                    )}
                  </Button>
                </div>
                {aiGeneratedInsight ? (
                  <div className="rounded-lg border p-4 bg-muted/50">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiGeneratedInsight}</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Click Generate to produce an AI-written insight paragraph.</div>
                )}

                {/* Descriptive analytics summary */}
                {descriptiveSummary && (
                  <div className="mt-6 pt-6 border-t">
                    <h4 className="font-semibold mb-2">Descriptive Analytics Summary</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">{descriptiveSummary}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              No analytics data available
            </div>
          )}
        </div>
      )}

      {activeTab === "feedback" && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Empty</div>
      )}
      {activeTab === "account_review" && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Empty</div>
      )}
    </div>
  );
}
