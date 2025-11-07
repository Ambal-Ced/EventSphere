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
import { TrendingUp, Users, Calendar, DollarSign, Package, Activity, RefreshCw, Lightbulb, Star, ChevronDown, ChevronUp, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#a855f7"];

export default function AdminPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  
  // Track window width for responsive charts
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
      const handleResize = () => setWindowWidth(window.innerWidth);
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "account_review" | "rating">("eventtria");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all" | "custom">("30d");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [aiGeneratedInsight, setAiGeneratedInsight] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [feedbackData, setFeedbackData] = useState<any>(null);
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedbackSeverityFilter, setFeedbackSeverityFilter] = useState<string>("all");
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<string>("all");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<string>("all");
  const [feedbackDateOrder, setFeedbackDateOrder] = useState<"desc" | "asc">("desc");
  const [ratingsData, setRatingsData] = useState<any>(null);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [ratingsError, setRatingsError] = useState<string | null>(null);
  const [ratingsFilter, setRatingsFilter] = useState<string>("all");
  const [ratingsDateOrder, setRatingsDateOrder] = useState<"desc" | "asc">("desc");
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [updatingFeedback, setUpdatingFeedback] = useState<string | null>(null);

  // Helpers are declared before usage to avoid temporal dead zone issues in hooks
  const formatCurrency = useCallback((cents: number) => {
    return `₱${(cents / 100).toFixed(2)}`;
  }, []);
  const formatNumber = useCallback((num: number) => {
    return num.toLocaleString();
  }, []);

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
  }, [analyticsData, formatCurrency]);
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

  const fetchFeedbackData = useCallback(async () => {
    setLoadingFeedback(true);
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

      const url = new URL("/api/admin/feedback", window.location.origin);
      if (startDate) url.searchParams.set("start", startDate);
      if (endDate) url.searchParams.set("end", endDate);
      // Add cache-busting parameter
      url.searchParams.set("_t", Date.now().toString());

      const res = await fetch(url.toString(), {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setFeedbackData(json);
      } else {
        console.error("Failed to fetch feedback data:", json);
      }
    } catch (error) {
      console.error("Error fetching feedback data:", error);
    } finally {
      setLoadingFeedback(false);
    }
  }, [dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (isAdmin && activeTab === "feedback") {
      const timeoutId = setTimeout(() => {
        fetchFeedbackData();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, activeTab, dateRange, customStartDate, customEndDate, fetchFeedbackData]);

  const fetchRatingsData = useCallback(async () => {
    setLoadingRatings(true);
    setRatingsError(null);
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

      const url = new URL("/api/admin/ratings", window.location.origin);
      if (startDate) url.searchParams.set("start", startDate);
      if (endDate) url.searchParams.set("end", endDate);
      // Add cache-busting parameter
      url.searchParams.set("_t", Date.now().toString());

      const res = await fetch(url.toString(), {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });
      const json = await res.json();
      if (res.ok) {
        setRatingsData(json);
        setRatingsError(null);
      } else {
        console.error("Failed to fetch ratings data:", json);
        setRatingsData(null);
        setRatingsError(json.error || `Failed to fetch ratings: ${res.status} ${res.statusText}`);
      }
    } catch (error: any) {
      console.error("Error fetching ratings data:", error);
      setRatingsData(null);
      setRatingsError(error.message || "Failed to fetch ratings data");
    } finally {
      setLoadingRatings(false);
    }
  }, [dateRange, customStartDate, customEndDate, supabase]);

  useEffect(() => {
    if (isAdmin && activeTab === "rating") {
      const timeoutId = setTimeout(() => {
        fetchRatingsData();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, activeTab, dateRange, customStartDate, customEndDate, fetchRatingsData]);

  // Toggle expand/collapse for feedback items
  const toggleFeedbackExpand = useCallback((feedbackId: string) => {
    setExpandedFeedbackIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(feedbackId)) {
        newSet.delete(feedbackId);
      } else {
        newSet.add(feedbackId);
      }
      return newSet;
    });
  }, []);

  // Open notes dialog
  const openNotesDialog = useCallback((feedbackId: string, currentNotes: string | null) => {
    setSelectedFeedbackId(feedbackId);
    setAdminNotes(currentNotes || "");
    setNotesDialogOpen(true);
  }, []);

  // Update admin notes
  const handleSaveNotes = useCallback(async () => {
    if (!selectedFeedbackId) return;

    setUpdatingFeedback(selectedFeedbackId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/admin/feedback/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          id: selectedFeedbackId,
          admin_notes: adminNotes.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to save admin notes");
      }

      // Update local state
      setFeedbackData((prev: any) => {
        if (!prev?.feedbackList) return prev;
        return {
          ...prev,
          feedbackList: prev.feedbackList.map((item: any) =>
            item.id === selectedFeedbackId
              ? { ...item, admin_notes: adminNotes.trim() || null }
              : item
          ),
        };
      });

      toast.success("Admin notes saved successfully");
      setNotesDialogOpen(false);
      setSelectedFeedbackId(null);
      setAdminNotes("");
    } catch (error: any) {
      console.error("Error saving admin notes:", error);
      toast.error(error.message || "Failed to save admin notes");
    } finally {
      setUpdatingFeedback(null);
    }
  }, [selectedFeedbackId, adminNotes, supabase]);

  // Close entry (change status to resolved)
  const handleCloseEntry = useCallback(async (feedbackId: string) => {
    setUpdatingFeedback(feedbackId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/admin/feedback/update", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          id: feedbackId,
          status: "resolved",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to close entry");
      }

      // Update local state for feedback list
      setFeedbackData((prev: any) => {
        if (!prev?.feedbackList) return prev;
        const updatedList = prev.feedbackList.map((item: any) =>
          item.id === feedbackId
            ? { ...item, status: "resolved" }
            : item
        );
        
        // Recalculate status statistics
        const statusCounts: Record<string, number> = {};
        updatedList.forEach((item: any) => {
          const status = item.status || "unknown";
          statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        
        const total = updatedList.length;
        const statusData = Object.entries(statusCounts)
          .map(([name, count]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: count,
            count,
            percentage: total > 0 ? (count / total) * 100 : 0,
          }))
          .sort((a, b) => b.count - a.count);
        
        return {
          ...prev,
          feedbackList: updatedList,
          status: statusData,
        };
      });

      toast.success("Feedback entry closed");
    } catch (error: any) {
      console.error("Error closing entry:", error);
      toast.error(error.message || "Failed to close entry");
    } finally {
      setUpdatingFeedback(null);
    }
  }, [supabase]);

  // Helper functions - must be defined before early returns
  const generateInsights = useCallback((data: any) => {
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
  }, [formatCurrency]);

  const generateAIInsight = useCallback(async () => {
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
      parts.push(`Revenue totals ${revenuePeso}; the typical purchase is around ${avgTx}${mean ? ", closely aligned with a mean of " + mean : ""}, suggesting pricing consistency.`);
      parts.push(`User growth over the most recent period is ${growth}, while subscription conversion is ${conv}. Together, these indicate the present balance between acquisition and monetization.`);
      if (paidRate || cancelledRate) {
        let txDesc = "Of recent transactions, ";
        if (paidRate) {
          txDesc += paidRate + " were paid";
        }
        if (paidRate && cancelledRate) {
          txDesc += ", and ";
        } else if (paidRate) {
          txDesc += ".";
        }
        if (cancelledRate) {
          txDesc += cancelledRate + " were cancelled.";
        }
        parts.push(txDesc);
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
  }, [analyticsData, isGeneratingInsight]);

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

  return (
    <>
      <div className="container mx-auto max-w-7xl py-4 sm:py-6 lg:py-8 px-4 sm:px-6">
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Comprehensive analytics and insights</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <select
            value={dateRange}
            onChange={(e) => {
              const value = e.target.value as "7d" | "30d" | "90d" | "all" | "custom";
              setDateRange(value);
              if (value !== "custom") {
                setShowCustomDatePicker(false);
              }
            }}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 w-full sm:w-auto"
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
                <Button variant="outline" size="sm" className="border-input bg-background text-foreground w-full sm:w-auto">
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
          <Button onClick={fetchAnalytics} disabled={loadingAnalytics} variant="outline" size="sm" className="border-input bg-background text-foreground w-full sm:w-auto">
            <RefreshCw className={`h-4 w-4 mr-2 ${loadingAnalytics ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="border-b mb-4 sm:mb-6 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div 
          className="overflow-x-auto overflow-y-hidden"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch'
          }}
          onWheel={(e) => {
            const element = e.currentTarget;
            if (e.deltaY !== 0) {
              element.scrollLeft += e.deltaY;
              e.preventDefault();
            }
          }}
        >
          <div className="flex gap-2 sm:gap-4 min-w-max pb-1 [&::-webkit-scrollbar]:hidden">
            <button
              onClick={() => setActiveTab("eventtria")}
              className={`px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "eventtria"
                  ? "bg-background border-b-2 border-primary text-primary"
                  : "hover:text-primary text-muted-foreground"
              }`}
            >
              EventTria
            </button>
            <button
              onClick={() => setActiveTab("feedback")}
              className={`px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "feedback"
                  ? "bg-background border-b-2 border-primary text-primary"
                  : "hover:text-primary text-muted-foreground"
              }`}
            >
              Feedback
            </button>
            <button
              onClick={() => setActiveTab("account_review")}
              className={`px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "account_review"
                  ? "bg-background border-b-2 border-primary text-primary"
                  : "hover:text-primary text-muted-foreground"
              }`}
            >
              Account Review
            </button>
            <button
              onClick={() => setActiveTab("rating")}
              className={`px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === "rating"
                  ? "bg-background border-b-2 border-primary text-primary"
                  : "hover:text-primary text-muted-foreground"
              }`}
            >
              Rating
            </button>
          </div>
        </div>
      </div>

      {activeTab === "eventtria" && (
        <div className="space-y-4 sm:space-y-6">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Users</div>
                    <Users className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.users || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {analyticsData.additional_metrics?.user_growth_rate !== undefined && (
                      <span className={analyticsData.additional_metrics.user_growth_rate >= 0 ? "text-green-600" : "text-red-600"}>
                        {analyticsData.additional_metrics.user_growth_rate >= 0 ? "+" : ""}
                        {analyticsData.additional_metrics.user_growth_rate.toFixed(1)}% growth
                      </span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Events</div>
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.events || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">Events created</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Transactions</div>
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.transactions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    {analyticsData.additional_metrics?.avg_transactions_per_user !== undefined && (
                      <span>{analyticsData.additional_metrics.avg_transactions_per_user.toFixed(2)} per user</span>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Revenue</div>
                    <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-4 sm:mt-6">
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Active Subscriptions</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.active_subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    of {formatNumber(analyticsData.totals?.users || 0)} users
                  </div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Conversion Rate</div>
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">
                    {analyticsData.additional_metrics?.conversion_rate !== undefined
                      ? `${analyticsData.additional_metrics.conversion_rate.toFixed(1)}%`
                      : "0%"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Users with subscriptions</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Subscriptions</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">All subscription records</div>
                </div>
              </div>

              {/* Revenue Statistics */}
              <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                <h3 className="text-base sm:text-lg font-semibold mb-4">Revenue Statistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Mean (Average)</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mean || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Average transaction value</div>
                  </div>
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Median</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.median || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Middle value</div>
                  </div>
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Mode (Most Common)</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mode || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Most frequent amount</div>
                  </div>
                </div>
              </div>

              {/* Time Series Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Events Over Time */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Events Created Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Transactions Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Revenue Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">User Growth Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Most Popular Subscriptions */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Most Popular Subscriptions</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Revenue by Subscription Plan</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
              {mounted && analyticsData.subscription_breakdown && analyticsData.subscription_breakdown.length > 0 && (() => {
                const pieData = analyticsData.subscription_breakdown.map((entry: any, index: number) => ({
                  ...entry,
                  fill: COLORS[index % COLORS.length],
                }));
                console.log('Pie data colors:', pieData.map((d: any) => ({ name: d.name, fill: d.fill })));
                return (
                  <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Subscription Distribution</h3>
                    <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(props: any) => {
                            const { name, percent } = props;
                            return `${name}: ${(percent * 100).toFixed(0)}%`;
                          }}
                          outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                          innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                          dataKey="count"
                          labelStyle={{ fill: '#ffffff', fontSize: windowWidth > 0 && windowWidth < 640 ? '10px' : '12px', fontWeight: 500 }}
                          isAnimationActive={false}
                        >
                          {pieData.map((entry: any, index: number) => {
                            const fillColor = entry.fill || COLORS[index % COLORS.length];
                            return (
                              <Cell 
                                key={`cell-sub-${index}-${entry.name}`}
                                fill={fillColor}
                                stroke={fillColor}
                                strokeWidth={2}
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }} 
                        />
                        <Legend 
                          wrapperStyle={{ color: 'currentColor' }} 
                          iconType="circle"
                          formatter={(value: string, entry: any) => {
                            const dataEntry = pieData.find((d: any) => d.name === value);
                            const legendColor = dataEntry?.fill || entry.color || '#999';
                            return <span style={{ color: legendColor }}>{value}</span>;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Event Creation Rate & Transaction Rates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Event Creation Rate */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Event Creation Rate</h3>
                  <div className="flex items-center justify-center mb-4">
                    <div className="text-center">
                      <div className="text-4xl sm:text-5xl font-bold text-primary">
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
                {mounted && analyticsData.transaction_rates && (() => {
                  const paidColor = COLORS[1]; // Green #10b981
                  const cancelledColor = COLORS[3]; // Red #ef4444
                  const pieData = [
                    { name: "Paid", value: analyticsData.transaction_rates.paid_rate || 0, fill: paidColor },
                    { name: "Cancelled", value: analyticsData.transaction_rates.cancelled_rate || 0, fill: cancelledColor },
                  ];
                  console.log('Transaction pie data:', pieData);
                  return (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Transaction Rates</h3>
                      <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props: any) => `${props.name}: ${((props.percent || 0) * 100).toFixed(1)}%`}
                            outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                            innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                            dataKey="value"
                            labelStyle={{ fill: '#ffffff', fontSize: windowWidth > 0 && windowWidth < 640 ? '10px' : '12px', fontWeight: 500 }}
                            isAnimationActive={false}
                          >
                            {pieData.map((entry, index) => {
                              const fillColor = entry.fill || (index === 0 ? paidColor : cancelledColor);
                              return (
                                <Cell 
                                  key={`cell-tx-${index}-${entry.name}`}
                                  fill={fillColor}
                                  stroke={fillColor}
                                  strokeWidth={2}
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                            labelStyle={{ color: '#cbd5e1' }} 
                            itemStyle={{ color: '#22c55e' }} 
                          />
                          <Legend 
                            wrapperStyle={{ color: 'currentColor' }} 
                            iconType="circle"
                            formatter={(value: string, entry: any) => {
                              const dataEntry = pieData.find((d: any) => d.name === value);
                              const legendColor = dataEntry?.fill || entry.color || '#999';
                              return <span style={{ color: legendColor }}>{value}</span>;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-xl sm:text-2xl font-bold text-green-600">
                            {analyticsData.transaction_rates.paid || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Paid</div>
                        </div>
                        <div>
                          <div className="text-xl sm:text-2xl font-bold text-red-600">
                            {analyticsData.transaction_rates.cancelled || 0}
                          </div>
                          <div className="text-xs text-muted-foreground">Cancelled</div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Sales by Event Category */}
              {analyticsData.sales_by_category && analyticsData.sales_by_category.length > 0 && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Sales by Event Category</h3>
                  <ResponsiveContainer width="100%" height={250}>
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
              <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h3 className="text-base sm:text-lg font-semibold">AI Insight</h3>
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
        <div className="space-y-4 sm:space-y-6">
          {loadingFeedback && !feedbackData ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <div>Loading feedback analytics...</div>
              </div>
            </div>
          ) : feedbackData ? (
            <div className={loadingFeedback ? "opacity-50 pointer-events-none" : ""}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Feedback</div>
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(feedbackData.total || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">All feedback entries</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Feedback Types</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(feedbackData.feedbackType?.length || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">Unique types</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Avg Rating</div>
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">
                    {feedbackData.ratingsWithValue > 0
                      ? (
                          feedbackData.rating.reduce((sum: number, r: any) => {
                            const ratingNum = parseInt(r.name.split(" ")[0]);
                            return sum + (r.count * ratingNum);
                          }, 0) /
                          feedbackData.ratingsWithValue
                        ).toFixed(1)
                      : "0.0"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">Out of 5 stars</div>
                </div>
              </div>

              {/* Feedback Type Charts */}
              {feedbackData.feedbackType && feedbackData.feedbackType.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Feedback Type Pie Chart */}
                  {mounted && (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Type</h3>
                      <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                        <PieChart>
                          <Pie
                            data={feedbackData.feedbackType.map((item: any, index: number) => ({
                              ...item,
                              fill: COLORS[index % COLORS.length],
                            }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props: any) => {
                              const { name, percent } = props;
                              return `${name}: ${(percent * 100).toFixed(0)}%`;
                            }}
                            outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                            innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                            dataKey="value"
                            labelStyle={{ fill: '#ffffff', fontSize: windowWidth > 0 && windowWidth < 640 ? '10px' : '12px', fontWeight: 500 }}
                            isAnimationActive={false}
                          >
                            {feedbackData.feedbackType.map((entry: any, index: number) => (
                              <Cell 
                                key={`cell-type-${index}-${entry.name}`}
                                fill={COLORS[index % COLORS.length]}
                                stroke={COLORS[index % COLORS.length]}
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                            labelStyle={{ color: '#cbd5e1' }} 
                            itemStyle={{ color: '#22c55e' }}
                            formatter={(value: any, name: any, props: any) => [
                              `${props.payload.count} (${props.payload.percentage.toFixed(1)}%)`,
                              name
                            ]}
                          />
                          <Legend 
                            wrapperStyle={{ color: 'currentColor' }} 
                            iconType="circle"
                            formatter={(value: string, entry: any) => {
                              const dataEntry = feedbackData.feedbackType.find((d: any) => d.name === value);
                              const legendColor = dataEntry ? COLORS[feedbackData.feedbackType.indexOf(dataEntry) % COLORS.length] : entry.color || '#999';
                              return <span style={{ color: legendColor }}>{value}</span>;
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Feedback Type Bar Chart */}
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback Type Distribution</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feedbackData.feedbackType.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" angle={-45} textAnchor="end" height={100} tick={{ fill: '#64748b' }} />
                        <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value} (${props.payload.percentage.toFixed(1)}%)`,
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                        <Bar dataKey="count" name="Count" shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const idx = payload?._index ?? 0;
                          return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                        }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Rating Charts */}
              {feedbackData.rating && feedbackData.ratingsWithValue > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Rating Pie Chart */}
                  {mounted && (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Rating</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                            <PieChart>
                              <Pie
                                data={feedbackData.rating.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                                innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                                dataKey="value"
                                isAnimationActive={false}
                              >
                                {feedbackData.rating.map((entry: any, index: number) => (
                                  <Cell 
                                    key={`cell-rating-${index}-${entry.name}`}
                                    fill={COLORS[index % COLORS.length]}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                                labelStyle={{ color: '#cbd5e1' }} 
                                itemStyle={{ color: '#22c55e' }}
                                formatter={(value: any, name: any, props: any) => [
                                  `${props.payload.count} (${props.payload.percentage.toFixed(1)}%)`,
                                  name
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                          {feedbackData.rating.map((item: any, index: number) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{item.name}:</span>
                              <span className="text-sm text-muted-foreground ml-auto">{item.percentage.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rating Bar Chart */}
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Rating Distribution</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feedbackData.rating.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                        <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value} (${props.payload.percentage.toFixed(1)}%)`,
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                        <Bar dataKey="count" name="Count" shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const idx = payload?._index ?? 0;
                          return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                        }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Status Charts */}
              {feedbackData.status && feedbackData.status.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Status Pie Chart */}
                  {mounted && (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Status</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                            <PieChart>
                              <Pie
                                data={feedbackData.status.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                                innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                                dataKey="value"
                                isAnimationActive={false}
                              >
                                {feedbackData.status.map((entry: any, index: number) => (
                                  <Cell 
                                    key={`cell-status-${index}-${entry.name}`}
                                    fill={COLORS[index % COLORS.length]}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                                labelStyle={{ color: '#cbd5e1' }} 
                                itemStyle={{ color: '#22c55e' }}
                                formatter={(value: any, name: any, props: any) => [
                                  `${props.payload.count} (${props.payload.percentage.toFixed(1)}%)`,
                                  name
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                          {feedbackData.status.map((item: any, index: number) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{item.name}:</span>
                              <span className="text-sm text-muted-foreground ml-auto">{item.percentage.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Status Bar Chart */}
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Status Distribution</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feedbackData.status.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                        <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value} (${props.payload.percentage.toFixed(1)}%)`,
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                        <Bar dataKey="count" name="Count" shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const idx = payload?._index ?? 0;
                          return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                        }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Priority Charts */}
              {feedbackData.priority && feedbackData.priority.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Priority Pie Chart */}
                  {mounted && (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Priority</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                            <PieChart>
                              <Pie
                                data={feedbackData.priority.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                                innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                                dataKey="value"
                                isAnimationActive={false}
                              >
                                {feedbackData.priority.map((entry: any, index: number) => (
                                  <Cell 
                                    key={`cell-priority-${index}-${entry.name}`}
                                    fill={COLORS[index % COLORS.length]}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                                labelStyle={{ color: '#cbd5e1' }} 
                                itemStyle={{ color: '#22c55e' }}
                                formatter={(value: any, name: any, props: any) => [
                                  `${props.payload.count} (${props.payload.percentage.toFixed(1)}%)`,
                                  name
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                          {feedbackData.priority.map((item: any, index: number) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{item.name}:</span>
                              <span className="text-sm text-muted-foreground ml-auto">{item.percentage.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Priority Bar Chart */}
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Priority Distribution</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={feedbackData.priority.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                        <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value} (${props.payload.percentage.toFixed(1)}%)`,
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                        <Bar dataKey="count" name="Count" shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const idx = payload?._index ?? 0;
                          return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                        }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Detailed Statistics Table */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Feedback Type Details */}
                {feedbackData.feedbackType && feedbackData.feedbackType.length > 0 && (
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback Type Breakdown</h3>
                    <div className="space-y-2">
                      {feedbackData.feedbackType.map((item: any, index: number) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div 
                              className="flex-shrink-0 w-4 h-4 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.name}</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm font-semibold ml-2">
                            {item.count} ({item.percentage.toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Priority Details */}
                {feedbackData.priority && feedbackData.priority.length > 0 && (
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Priority Breakdown</h3>
                    <div className="space-y-2">
                      {feedbackData.priority.map((item: any, index: number) => (
                        <div key={item.name} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div 
                              className="flex-shrink-0 w-4 h-4 rounded-full" 
                              style={{ backgroundColor: COLORS[index % COLORS.length] }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{item.name}</div>
                            </div>
                          </div>
                          <div className="flex-shrink-0 text-sm font-semibold ml-2">
                            {item.count} ({item.percentage.toFixed(1)}%)
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Feedback List Section */}
              {feedbackData.feedbackList && feedbackData.feedbackList.length > 0 && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-base sm:text-lg font-semibold">Feedback List</h3>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {/* Severity Filter */}
                      <select
                        value={feedbackSeverityFilter}
                        onChange={(e) => setFeedbackSeverityFilter(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="all">All Severity</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>

                      {/* Rating Filter */}
                      <select
                        value={feedbackRatingFilter}
                        onChange={(e) => setFeedbackRatingFilter(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="all">All Ratings</option>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                        <option value="0">No Rating</option>
                      </select>

                      {/* Status Filter */}
                      <select
                        value={feedbackStatusFilter}
                        onChange={(e) => setFeedbackStatusFilter(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="all">All Status</option>
                        <option value="open">Open</option>
                        <option value="resolved">Resolved</option>
                      </select>

                      {/* Date Order */}
                      <select
                        value={feedbackDateOrder}
                        onChange={(e) => setFeedbackDateOrder(e.target.value as "desc" | "asc")}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtered and Sorted Feedback List */}
                  {(() => {
                    let filtered = [...(feedbackData.feedbackList || [])];

                    // Filter by severity/priority
                    if (feedbackSeverityFilter !== "all") {
                      filtered = filtered.filter((item: any) => 
                        (item.priority || "").toLowerCase() === feedbackSeverityFilter.toLowerCase()
                      );
                    }

                    // Filter by rating
                    if (feedbackRatingFilter !== "all") {
                      const ratingValue = parseInt(feedbackRatingFilter);
                      if (ratingValue === 0) {
                        filtered = filtered.filter((item: any) => 
                          item.rating === null || item.rating === undefined
                        );
                      } else {
                        filtered = filtered.filter((item: any) => 
                          item.rating === ratingValue
                        );
                      }
                    }

                    // Filter by status
                    if (feedbackStatusFilter !== "all") {
                      filtered = filtered.filter((item: any) => 
                        (item.status || "open").toLowerCase() === feedbackStatusFilter.toLowerCase()
                      );
                    }

                    // Sort: First by status (open first, resolved last), then by date
                    filtered.sort((a: any, b: any) => {
                      const statusA = (a.status || "open").toLowerCase();
                      const statusB = (b.status || "open").toLowerCase();
                      
                      // Resolved entries go to the bottom
                      if (statusA === "resolved" && statusB !== "resolved") return 1;
                      if (statusA !== "resolved" && statusB === "resolved") return -1;
                      
                      // If same status, sort by date
                      const dateA = new Date(a.created_at).getTime();
                      const dateB = new Date(b.created_at).getTime();
                      return feedbackDateOrder === "desc" ? dateB - dateA : dateA - dateB;
                    });

                    return (
                      <div>
                        {filtered.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No feedback matches the selected filters
                          </div>
                        ) : (
                          <>
                            <div className="text-xs sm:text-sm text-muted-foreground mb-3">
                              {filtered.length} feedback {filtered.length === 1 ? 'entry' : 'entries'}
                              {filtered.length > 10 && " (scroll to see all)"}
                            </div>
                            <div 
                              className="overflow-y-auto space-y-3 pr-2 border rounded-md p-2"
                              style={{ maxHeight: '800px' }}
                            >
                              {filtered.map((item: any) => {
                                const isExpanded = expandedFeedbackIds.has(item.id);
                                const isUpdating = updatingFeedback === item.id;
                                
                                return (
                                  <div
                                    key={item.id}
                                    className="rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                                  >
                                    {/* Main content - clickable to expand */}
                                    <div
                                      className="p-4 cursor-pointer"
                                      onClick={() => toggleFeedbackExpand(item.id)}
                                    >
                                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start gap-2 mb-2">
                                            <h4 className="font-semibold text-sm sm:text-base truncate">{item.title}</h4>
                                            <span className="text-xs px-2 py-1 rounded bg-primary/20 text-primary flex-shrink-0">
                                              {item.feedback_type?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "Unknown"}
                                            </span>
                                            {/* Status Badge */}
                                            <span className={`text-xs px-2 py-1 rounded flex-shrink-0 ${
                                              item.status === "resolved" 
                                                ? "bg-green-500/20 text-green-500" 
                                                : "bg-blue-500/20 text-blue-500"
                                            }`}>
                                              {item.status === "resolved" ? "Resolved" : "Open"}
                                            </span>
                                          </div>
                                          <p className={`text-xs sm:text-sm text-muted-foreground mb-2 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                            {item.description}
                                          </p>
                                          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                                            <span>
                                              {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-3 flex-shrink-0">
                                          {/* Expand/Collapse Icon */}
                                          <div className="flex-shrink-0">
                                            {isExpanded ? (
                                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                            ) : (
                                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                            )}
                                          </div>
                                          
                                          {/* Severity/Priority Badge */}
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs font-medium text-muted-foreground">Severity</span>
                                            <span className={`text-xs font-semibold px-2 py-1 rounded ${
                                              item.priority === "urgent" ? "bg-red-500/20 text-red-500" :
                                              item.priority === "high" ? "bg-orange-500/20 text-orange-500" :
                                              item.priority === "medium" ? "bg-yellow-500/20 text-yellow-500" :
                                              item.priority === "low" ? "bg-green-500/20 text-green-500" :
                                              "bg-muted text-muted-foreground"
                                            }`}>
                                              {(item.priority || "N/A").charAt(0).toUpperCase() + (item.priority || "N/A").slice(1)}
                                            </span>
                                          </div>

                                          {/* Rating Badge */}
                                          <div className="flex flex-col items-end gap-1">
                                            <span className="text-xs font-medium text-muted-foreground">Rating</span>
                                            {item.rating !== null && item.rating !== undefined ? (
                                              <div className="flex items-center gap-1">
                                                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                                <span className="text-xs font-semibold">{item.rating}</span>
                                              </div>
                                            ) : (
                                              <span className="text-xs text-muted-foreground">No rating</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Expanded content */}
                                    {isExpanded && (
                                      <div className="px-4 pb-4 pt-0 border-t mt-2" onClick={(e) => e.stopPropagation()}>
                                        <div className="mt-4 space-y-3">
                                          {/* Full description */}
                                          <div>
                                            <h5 className="text-xs font-medium text-muted-foreground mb-1">Full Description</h5>
                                            <p className="text-sm text-foreground whitespace-pre-wrap">{item.description}</p>
                                          </div>

                                          {/* Admin Notes */}
                                          {item.admin_notes && (
                                            <div>
                                              <h5 className="text-xs font-medium text-muted-foreground mb-1">Admin Notes</h5>
                                              <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 p-2 rounded">{item.admin_notes}</p>
                                            </div>
                                          )}

                                          {/* Action buttons */}
                                          <div className="flex flex-wrap gap-2 pt-2">
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => openNotesDialog(item.id, item.admin_notes)}
                                              disabled={isUpdating}
                                              className="text-xs"
                                            >
                                              <FileText className="h-3 w-3 mr-1" />
                                              {item.admin_notes ? "Edit Notes" : "Add Notes"}
                                            </Button>
                                            
                                            {item.status === "open" && (
                                              <Button
                                                size="sm"
                                                variant="default"
                                                onClick={() => handleCloseEntry(item.id)}
                                                disabled={isUpdating}
                                                className="text-xs"
                                              >
                                                {isUpdating ? "Closing..." : "Close Entry"}
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              No feedback data available
            </div>
          )}
        </div>
      )}
      {activeTab === "account_review" && (
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Empty</div>
      )}
      {activeTab === "rating" && (
        <div>
          {loadingRatings ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Loading ratings data...
            </div>
          ) : ratingsError ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-sm">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                <p className="font-semibold">Error loading ratings data</p>
                <p className="mt-2 text-xs">{ratingsError}</p>
                <button
                  onClick={() => fetchRatingsData()}
                  className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : ratingsData ? (
            <div>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-4">
                <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Total Stars</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{ratingsData.totalStars || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">from {ratingsData.total || 0} {ratingsData.total === 1 ? 'rating' : 'ratings'}</p>
                    </div>
                    <Star className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-yellow-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Website Rating</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{ratingsData.websiteRating || "0.0"}%</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">Avg: {ratingsData.averageRating || "0.00"} / 5</p>
                    </div>
                    <Star className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-yellow-400 fill-yellow-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Average Rating</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{ratingsData.averageRating || "0.00"}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">out of 5 stars</p>
                    </div>
                    <Star className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-yellow-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">With Suggestions</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{ratingsData.withSuggestions || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {ratingsData.total > 0 ? ((ratingsData.withSuggestions / ratingsData.total) * 100).toFixed(1) : 0}% of total
                      </p>
                    </div>
                    <FileText className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-blue-400 flex-shrink-0" />
                  </div>
                </div>

                <div className="rounded-lg border p-3 sm:p-4 lg:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm text-muted-foreground mb-1 truncate">Rated Users</p>
                      <p className="text-xl sm:text-2xl lg:text-3xl font-bold break-words">{ratingsData.ratedCount || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">with 1-5 stars</p>
                    </div>
                    <Users className="h-6 w-6 sm:h-8 sm:w-8 lg:h-10 lg:w-10 text-green-400 flex-shrink-0" />
                  </div>
                </div>
              </div>

              {/* Rating Charts */}
              {ratingsData.rating && ratingsData.rating.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                  {/* Rating Pie Chart */}
                  {mounted && (
                    <div className="rounded-lg border p-4 sm:p-6 bg-card">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Rating Distribution</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={windowWidth > 0 && windowWidth < 640 ? 280 : 300}>
                            <PieChart>
                              <Pie
                                data={ratingsData.rating.filter((item: any) => item.count > 0).map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={windowWidth > 0 && windowWidth < 640 ? 80 : windowWidth > 0 && windowWidth < 1024 ? 90 : 100}
                                innerRadius={windowWidth > 0 && windowWidth < 640 ? 30 : 0}
                                dataKey="value"
                                isAnimationActive={false}
                              >
                                {ratingsData.rating.filter((item: any) => item.count > 0).map((entry: any, index: number) => (
                                  <Cell 
                                    key={`cell-rating-${index}-${entry.name}`}
                                    fill={COLORS[index % COLORS.length]}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                  />
                                ))}
                              </Pie>
                              <Tooltip 
                                contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                                labelStyle={{ color: '#cbd5e1' }} 
                                itemStyle={{ color: '#22c55e' }}
                                formatter={(value: any, name: any, props: any) => [
                                  `${props.payload.count} (${props.payload.percentage.toFixed(1)}%)`,
                                  name
                                ]}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex-1 flex flex-col justify-center gap-2">
                          {ratingsData.rating.filter((item: any) => item.count > 0).map((item: any, index: number) => (
                            <div key={item.name} className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0" 
                                style={{ backgroundColor: COLORS[index % COLORS.length] }}
                              />
                              <span className="text-sm font-medium">{item.name}:</span>
                              <span className="text-sm text-muted-foreground ml-auto">{item.percentage.toFixed(1)}%</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rating Bar Chart */}
                  <div className="rounded-lg border p-4 sm:p-6 bg-card">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Rating Breakdown</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={ratingsData.rating.filter((item: any) => item.count > 0).map((item: any, idx: number) => ({ ...item, _index: idx }))}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs" tick={{ fill: '#64748b' }} />
                        <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }}
                          formatter={(value: any, name: any, props: any) => [
                            `${value} (${props.payload.percentage.toFixed(1)}%)`,
                            name
                          ]}
                        />
                        <Legend wrapperStyle={{ color: '#1e293b' }} />
                        <Bar dataKey="count" name="Count" shape={(props: any) => {
                          const { x, y, width, height, payload } = props;
                          const idx = payload?._index ?? 0;
                          return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                        }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Ratings List Section */}
              {ratingsData.ratingsList && ratingsData.ratingsList.length > 0 && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <h3 className="text-base sm:text-lg font-semibold">Ratings List</h3>
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      {/* Rating Filter */}
                      <select
                        value={ratingsFilter}
                        onChange={(e) => setRatingsFilter(e.target.value)}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="all">All Ratings</option>
                        <option value="5">5 Stars</option>
                        <option value="4">4 Stars</option>
                        <option value="3">3 Stars</option>
                        <option value="2">2 Stars</option>
                        <option value="1">1 Star</option>
                        <option value="0">No Rating</option>
                      </select>

                      {/* Date Order */}
                      <select
                        value={ratingsDateOrder}
                        onChange={(e) => setRatingsDateOrder(e.target.value as "desc" | "asc")}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      >
                        <option value="desc">Newest First</option>
                        <option value="asc">Oldest First</option>
                      </select>
                    </div>
                  </div>

                  {/* Filtered and Sorted Ratings List */}
                  {(() => {
                    let filtered = [...(ratingsData.ratingsList || [])];

                    // Filter by rating
                    if (ratingsFilter !== "all") {
                      const ratingValue = parseInt(ratingsFilter);
                      filtered = filtered.filter((item: any) => item.rating === ratingValue);
                    }

                    // Sort by date
                    filtered.sort((a: any, b: any) => {
                      const dateA = new Date(a.created_at).getTime();
                      const dateB = new Date(b.created_at).getTime();
                      return ratingsDateOrder === "desc" ? dateB - dateA : dateA - dateB;
                    });

                    return (
                      <div>
                        {filtered.length === 0 ? (
                          <div className="text-center py-8 text-sm text-muted-foreground">
                            No ratings match the selected filters
                          </div>
                        ) : (
                          <>
                            <div className="text-xs sm:text-sm text-muted-foreground mb-3">
                              {filtered.length} rating {filtered.length === 1 ? 'entry' : 'entries'}
                              {filtered.length > 10 && " (scroll to see all)"}
                            </div>
                            <div 
                              className="overflow-y-auto space-y-3 pr-2 border rounded-md p-2"
                              style={{ maxHeight: '800px' }}
                            >
                              {filtered.map((item: any) => (
                                <div
                                  key={item.id}
                                  className="rounded-lg border p-3 sm:p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                                    <div className="flex-1 min-w-0 overflow-hidden">
                                      <div className="flex flex-col sm:flex-row sm:items-start gap-2 mb-2">
                                        <h4 className="font-semibold text-sm sm:text-base truncate min-w-0">{item.user_name}</h4>
                                        {item.user_email && (
                                          <span className="text-xs text-muted-foreground truncate min-w-0">({item.user_email})</span>
                                        )}
                                      </div>
                                      {item.suggestion && (
                                        <p className="text-xs sm:text-sm text-muted-foreground mb-2 whitespace-pre-wrap break-words">
                                          {item.suggestion}
                                        </p>
                                      )}
                                      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                                        <span className="break-words">
                                          Rated on {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        {item.updated_at !== item.created_at && (
                                          <span className="text-muted-foreground/70 break-words">
                                            (Updated {new Date(item.updated_at).toLocaleDateString()})
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 sm:self-start">
                                      {/* Rating Display */}
                                      <div className="flex flex-col items-start sm:items-end gap-1">
                                        <span className="text-xs font-medium text-muted-foreground">Rating</span>
                                        {item.rating > 0 ? (
                                          <div className="flex items-center gap-1">
                                            {[1, 2, 3, 4, 5].map((star) => (
                                              <Star
                                                key={star}
                                                className={`h-4 w-4 flex-shrink-0 ${
                                                  star <= item.rating
                                                    ? "fill-yellow-400 text-yellow-400"
                                                    : "text-muted-foreground"
                                                }`}
                                              />
                                            ))}
                                            <span className="text-xs font-semibold ml-1">{item.rating}</span>
                                          </div>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">No rating</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {(!ratingsData.ratingsList || ratingsData.ratingsList.length === 0) && (
                <div className="rounded-lg border p-6 bg-card mt-4 sm:mt-6">
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    No ratings data available
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              No ratings data available
            </div>
          )}
        </div>
      )}

      {/* Admin Notes Dialog */}
      <Dialog 
        open={notesDialogOpen} 
        onOpenChange={(open) => {
          setNotesDialogOpen(open);
          if (!open) {
            // When dialog closes, reset state but don't clear notes if we're just closing temporarily
            // The notes will be reloaded when reopening via openNotesDialog
            setSelectedFeedbackId(null);
            setAdminNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Admin Notes</DialogTitle>
            <DialogDescription>
              Add or edit notes for this feedback entry. These notes are only visible to admins.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="admin-notes" className="text-sm font-medium mb-2 block">
                Notes
              </label>
              <textarea
                id="admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Enter admin notes here..."
                className="w-full min-h-[150px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setNotesDialogOpen(false);
                setSelectedFeedbackId(null);
                setAdminNotes("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNotes}
              disabled={updatingFeedback !== null}
            >
              {updatingFeedback ? "Saving..." : "Save Notes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </>
  );
}
