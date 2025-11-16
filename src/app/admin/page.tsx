"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import { useSessionCache } from "@/hooks/use-session-cache";
// Lazy-load heavy Recharts components (client-only)
const loadingBox = (h:number=300) => <div style={{height:h}} className="w-full animate-pulse rounded bg-muted/20"/>;
const ResponsiveContainer: any = dynamic(() => import("recharts").then(m => m.ResponsiveContainer as any), { ssr: false, loading: () => loadingBox() }) as any;
const LineChart: any = dynamic(() => import("recharts").then(m => m.LineChart as any), { ssr: false, loading: () => null }) as any;
const Line: any = dynamic(() => import("recharts").then(m => m.Line as any), { ssr: false, loading: () => null }) as any;
const AreaChart: any = dynamic(() => import("recharts").then(m => m.AreaChart as any), { ssr: false, loading: () => null }) as any;
const Area: any = dynamic(() => import("recharts").then(m => m.Area as any), { ssr: false, loading: () => null }) as any;
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
import { TrendingUp, Users, Calendar, DollarSign, Package, Activity, RefreshCw, Lightbulb, Star, ChevronDown, ChevronUp, FileText, X, AlertTriangle, Target } from "lucide-react";
import { RoipSummaryCards } from "@/components/admin/roip-summary-cards";

// Lazy load the chart component
const RoipChart = dynamic(() => import("@/components/admin/roip-chart").then(m => ({ default: m.RoipChart })), {
  ssr: false,
  loading: () => <div className="w-full h-[400px] animate-pulse rounded bg-muted/20" />
});
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
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "users" | "roip" | "rating">("eventtria");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all" | "custom">("30d");
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>();
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>();
  const [showCustomDatePicker, setShowCustomDatePicker] = useState(false);
  const [aiGeneratedInsight, setAiGeneratedInsight] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState<number>(0);
  const [predictionsData, setPredictionsData] = useState<any>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
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
  const [accountDeletionData, setAccountDeletionData] = useState<any>(null);
  const [loadingAccountDeletion, setLoadingAccountDeletion] = useState(false);
  const [accountDeletionError, setAccountDeletionError] = useState<string | null>(null);
  const [accountDeletionStatusFilter, setAccountDeletionStatusFilter] = useState<string>("all");
  const [accountDeletionSort, setAccountDeletionSort] = useState<"desc" | "asc">("desc");
  const [updatingAccountDeletionId, setUpdatingAccountDeletionId] = useState<string | null>(null);
  const [bulkUpdatingAccountDeletion, setBulkUpdatingAccountDeletion] = useState<"approve" | "deny" | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [expandedFeedbackIds, setExpandedFeedbackIds] = useState<Set<string>>(new Set());
  const [notesDialogOpen, setNotesDialogOpen] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [updatingFeedback, setUpdatingFeedback] = useState<string | null>(null);
  const [roipData, setRoipData] = useState<any>(null);
  const [loadingRoip, setLoadingRoip] = useState(false);
  const [roipError, setRoipError] = useState<string | null>(null);
  const [adminCosts, setAdminCosts] = useState<any[]>([]);
  const [loadingCosts, setLoadingCosts] = useState(false);
  const [costsError, setCostsError] = useState<string | null>(null);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [newCost, setNewCost] = useState({ cost_type: "repair", description: "", amount_cents: 0, date_incurred: new Date().toISOString().split('T')[0] });
  const [submittingCost, setSubmittingCost] = useState(false);
  const [roipPredictionInsight, setRoipPredictionInsight] = useState<string | null>(null);
  const [isGeneratingRoipInsight, setIsGeneratingRoipInsight] = useState(false);

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
          .maybeSingle();
        if (!cancelled) {
          setIsAdmin((data?.account_type as string | undefined) === "admin");
        }
        if (error && error.code !== "PGRST116") {
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

  // Use session cache to avoid multiple session fetches
  const { user: cachedUser } = useSessionCache();

  const fetchAnalytics = useCallback(async () => {
    if (!cachedUser) return;
    
    setLoadingAnalytics(true);
    try {
      // Get session for access token
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
        setAnalyticsData(json);
      } else {
        console.error("Failed to fetch analytics:", json);
      }
    } catch (error) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [cachedUser, dateRange, customStartDate, customEndDate]);

  useEffect(() => {
    if (isAdmin) {
      // Small delay to debounce rapid changes
      const timeoutId = setTimeout(() => {
        fetchAnalytics();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, dateRange, customStartDate, customEndDate, fetchAnalytics]);

  const fetchPredictions = useCallback(async () => {
    if (!analyticsData || !analyticsData.time_series) return;
    
    setLoadingPredictions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/admin/analytics/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          time_series: analyticsData.time_series,
          totals: analyticsData.totals,
          additional_metrics: analyticsData.additional_metrics,
        }),
        next: { revalidate: 60 },
      });
      
      const json = await res.json();
      if (res.ok) {
        setPredictionsData(json);
      } else {
        console.error("Failed to fetch predictions:", json);
      }
    } catch (error) {
      console.error("Error fetching predictions:", error);
    } finally {
      setLoadingPredictions(false);
    }
  }, [analyticsData, supabase]);

  useEffect(() => {
    if (analyticsData && analyticsData.time_series && analyticsData.time_series.length > 0) {
      fetchPredictions();
    }
  }, [analyticsData, fetchPredictions]);

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

  const fetchRoipData = useCallback(async () => {
    setLoadingRoip(true);
    setRoipError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/admin/roip", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        next: { revalidate: 60 }, // Use Next.js caching with revalidation
      });
      const json = await res.json();
      if (res.ok) {
        setRoipData(json);
        setRoipError(null);
      } else {
        console.error("Failed to fetch ROIP data:", json);
        setRoipData(null);
        setRoipError(json.error || `Failed to fetch ROIP: ${res.status} ${res.statusText}`);
      }
    } catch (error: any) {
      console.error("Error fetching ROIP data:", error);
      setRoipData(null);
      setRoipError(error.message || "Failed to fetch ROIP data");
    } finally {
      setLoadingRoip(false);
    }
  }, [supabase]);

  const fetchAdminCosts = useCallback(async () => {
    setLoadingCosts(true);
    setCostsError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const res = await fetch("/api/admin/costs", {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        next: { revalidate: 30 }, // Use Next.js caching with revalidation
      });
      const json = await res.json();
      if (res.ok) {
        setAdminCosts(json.costs || []);
        setCostsError(null);
      } else {
        console.error("Failed to fetch admin costs:", json);
        setAdminCosts([]);
        setCostsError(json.error || `Failed to fetch costs: ${res.status} ${res.statusText}`);
      }
    } catch (error: any) {
      console.error("Error fetching admin costs:", error);
      setAdminCosts([]);
      setCostsError(error.message || "Failed to fetch admin costs");
    } finally {
      setLoadingCosts(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isAdmin && activeTab === "roip") {
      const timeoutId = setTimeout(() => {
        fetchRoipData();
        fetchAdminCosts();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, activeTab, fetchRoipData, fetchAdminCosts]);

  const handleAddCost = useCallback(async () => {
    if (!newCost.amount_cents || newCost.amount_cents <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }
    setSubmittingCost(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/costs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(newCost),
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Cost added successfully");
        setNewCost({ cost_type: "repair", description: "", amount_cents: 0, date_incurred: new Date().toISOString().split('T')[0] });
        setShowCostDialog(false);
        fetchAdminCosts();
        fetchRoipData();
      } else {
        toast.error(json.error || "Failed to add cost");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to add cost");
    } finally {
      setSubmittingCost(false);
    }
  }, [newCost, supabase, fetchAdminCosts, fetchRoipData]);

  const handleDeleteCost = useCallback(async (costId: string) => {
    if (!confirm("Are you sure you want to delete this cost?")) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/admin/costs?id=${costId}`, {
        method: "DELETE",
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      });
      const json = await res.json();
      if (res.ok) {
        toast.success("Cost deleted successfully");
        fetchAdminCosts();
        fetchRoipData();
      } else {
        toast.error(json.error || "Failed to delete cost");
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to delete cost");
    }
  }, [supabase, fetchAdminCosts, fetchRoipData]);

  const generateRoipPredictionInsight = useCallback(async () => {
    if (!roipData || isGeneratingRoipInsight) return;

    setIsGeneratingRoipInsight(true);
    setRoipPredictionInsight(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Prepare context with ROIP data - convert cents to PHP amounts for AI
      const context = {
        current_roi: roipData.current_roi,
        total_revenue_php: roipData.total_revenue ? (roipData.total_revenue / 100).toFixed(2) : "0.00",
        total_costs_php: roipData.total_costs ? (roipData.total_costs / 100).toFixed(2) : "0.00",
        net_income_php: roipData.net_income ? (roipData.net_income / 100).toFixed(2) : "0.00",
        historical_data: (roipData.historical || []).map((h: any) => ({
          month: h.month,
          revenue_php: h.revenue ? (h.revenue / 100).toFixed(2) : "0.00",
          costs_php: h.costs ? (h.costs / 100).toFixed(2) : "0.00",
          net_php: h.net ? (h.net / 100).toFixed(2) : "0.00",
        })),
        predictions: (roipData.predictions || []).map((p: any) => ({
          month: p.month,
          predicted_revenue_php: p.predicted_revenue ? (p.predicted_revenue / 100).toFixed(2) : "0.00",
          predicted_costs_php: p.predicted_costs ? (p.predicted_costs / 100).toFixed(2) : "0.00",
          predicted_roi: p.predicted_roi,
        })),
        method: roipData.method,
        analysis: roipData.analysis || null,
      };

      const prompt = `You are a financial analytics AI assistant. Based on the ROI prediction data provided, write a comprehensive but CONCISE predictive analytics summary in paragraph form (not bullet points) that includes:

**Current Performance Analysis**: Describe the current ROI performance (${roipData.current_roi?.toFixed(2) || 0}%), total revenue (PHP ${context.total_revenue_php}), total costs (PHP ${context.total_costs_php}), and net income (PHP ${context.net_income_php}). Explain what these numbers indicate about the business health and financial position.

**Historical Trend Analysis**: Analyze the historical revenue and cost patterns over the past months. Identify trends, patterns, and any notable changes in the financial performance. Discuss how revenue and costs have evolved over time.

**Predictive Analytics**: Based on the predicted ROI trajectory for the next 6 months, forecast what to expect. Include specific predicted ROI percentages, revenue projections (PHP format), and cost projections (PHP format) for upcoming months. Explain the trajectory - whether ROI is improving, declining, or stabilizing, and what factors might influence these predictions.

**Risk Assessment**: Identify potential risks and opportunities based on the cost structure (repair, expansion, hosting) and revenue patterns. Discuss any concerns about sustainability or growth potential.

**Strategic Recommendations**: Provide actionable recommendations to improve ROI, optimize costs, increase revenue, and enhance overall financial performance.

IMPORTANT: 
- All monetary values in the context are already in PHP (not cents). Use them directly with PHP currency format (e.g., PHP 1,350.00).
- Write in paragraph form (not bullet points) to create a flowing narrative summary.
- Be concise but comprehensive - summarize key predictive insights efficiently.
- Use specific numbers, percentages, and PHP currency format where available.
- Focus on predictive analytics - what the data suggests will happen in the future.
- Keep the total response under 400 words while covering all aspects.`;

      const res = await fetch("/api/admin/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          context,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setRoipPredictionInsight(json.text || "Insight generated successfully.");
      } else {
        toast.error(json.error || "Failed to generate prediction insight");
        setRoipPredictionInsight("Failed to generate insight. Please try again.");
      }
    } catch (error: any) {
      console.error("Error generating ROIP prediction insight:", error);
      toast.error(error.message || "Failed to generate prediction insight");
      setRoipPredictionInsight("Failed to generate insight. Please try again.");
    } finally {
      setIsGeneratingRoipInsight(false);
    }
  }, [roipData, isGeneratingRoipInsight, supabase]);

  const fetchAccountDeletionData = useCallback(async () => {
    setLoadingAccountDeletion(true);
    setAccountDeletionError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch("/api/admin/account-deletion-requests", {
        headers: {
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          "Cache-Control": "no-cache",
        },
        cache: "no-store",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to fetch account deletion requests");
      }

      setAccountDeletionData(json);
    } catch (error: any) {
      console.error("Error fetching account deletion data:", error);
      setAccountDeletionError(error.message || "Failed to load account deletion requests");
      setAccountDeletionData(null);
    } finally {
      setLoadingAccountDeletion(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isAdmin && activeTab === "users") {
      const timeoutId = setTimeout(() => {
        fetchAccountDeletionData();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
  }, [isAdmin, activeTab, fetchAccountDeletionData]);

  const handleAccountDeletionStatusUpdate = useCallback(async (
    action: "approve" | "deny",
    options?: { ids?: string[]; allPending?: boolean }
  ) => {
    const targetIds = options?.ids ?? [];
    const isBulkAll = Boolean(options?.allPending);

    if (!isBulkAll && targetIds.length === 0) {
      return;
    }

    if (isBulkAll) {
      setBulkUpdatingAccountDeletion(action);
    } else if (targetIds.length === 1) {
      setUpdatingAccountDeletionId(targetIds[0]);
    } else {
      setBulkUpdatingAccountDeletion(action);
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/account-deletion-requests/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          action,
          ids: isBulkAll ? undefined : targetIds,
          all_pending: isBulkAll,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to update account deletion request");
      }

      toast.success(json.message || "Account deletion requests updated");
      await fetchAccountDeletionData();
    } catch (error: any) {
      console.error("Error updating account deletion request:", error);
      toast.error(error.message || "Failed to update account deletion request");
    } finally {
      setUpdatingAccountDeletionId(null);
      setBulkUpdatingAccountDeletion(null);
    }
  }, [supabase, fetchAccountDeletionData]);

  const handleDeleteApprovedAccount = useCallback(async (requestId: string, userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this account and all associated data? This action cannot be undone.")) {
      return;
    }

    setDeletingAccountId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/account-deletion-requests/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          request_id: requestId,
          user_id: userId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to delete account");
      }

      toast.success(json.message || "Account deleted successfully");
      await fetchAccountDeletionData();
    } catch (error: any) {
      console.error("Error deleting account:", error);
      toast.error(error.message || "Failed to delete account");
    } finally {
      setDeletingAccountId(null);
    }
  }, [supabase, fetchAccountDeletionData]);

  // Real-time subscriptions for live updates
  const analyticsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const feedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ratingsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const accountDeletionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    let analyticsChannel: any;
    let feedbackChannel: any;
    let ratingsChannel: any;
    let accountDeletionChannel: any;

    // Subscribe to events and transactions for analytics (EventTria tab)
    if (activeTab === "eventtria") {
      analyticsChannel = supabase
        .channel("admin-analytics-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "events",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (analyticsTimeoutRef.current) clearTimeout(analyticsTimeoutRef.current);
            analyticsTimeoutRef.current = setTimeout(() => {
              fetchAnalytics();
            }, 2000);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "overall_transaction",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (analyticsTimeoutRef.current) clearTimeout(analyticsTimeoutRef.current);
            analyticsTimeoutRef.current = setTimeout(() => {
              fetchAnalytics();
            }, 2000);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "profiles",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (analyticsTimeoutRef.current) clearTimeout(analyticsTimeoutRef.current);
            analyticsTimeoutRef.current = setTimeout(() => {
              fetchAnalytics();
            }, 2000);
          }
        )
        .subscribe();
    }

    // Subscribe to feedback for Feedback tab
    if (activeTab === "feedback") {
      feedbackChannel = supabase
        .channel("admin-feedback-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "feedback",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = setTimeout(() => {
              fetchFeedbackData();
            }, 1000);
          }
        )
        .subscribe();
    }

    // Subscribe to ratings for Rating tab
    if (activeTab === "rating") {
      ratingsChannel = supabase
        .channel("admin-ratings-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "ratings",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (ratingsTimeoutRef.current) clearTimeout(ratingsTimeoutRef.current);
            ratingsTimeoutRef.current = setTimeout(() => {
              fetchRatingsData();
            }, 1000);
          }
        )
        .subscribe();
    }

    // Subscribe to account deletion requests for Users tab
    if (activeTab === "users") {
      accountDeletionChannel = supabase
        .channel("admin-account-deletion-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "account_deletion_requests",
          },
          () => {
            // Debounce refresh to avoid too many requests
            if (accountDeletionTimeoutRef.current) clearTimeout(accountDeletionTimeoutRef.current);
            accountDeletionTimeoutRef.current = setTimeout(() => {
              fetchAccountDeletionData();
            }, 1000);
          }
        )
        .subscribe();
    }

    return () => {
      if (analyticsTimeoutRef.current) clearTimeout(analyticsTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
      if (ratingsTimeoutRef.current) clearTimeout(ratingsTimeoutRef.current);
      if (accountDeletionTimeoutRef.current) clearTimeout(accountDeletionTimeoutRef.current);
      if (analyticsChannel) supabase.removeChannel(analyticsChannel);
      if (feedbackChannel) supabase.removeChannel(feedbackChannel);
      if (ratingsChannel) supabase.removeChannel(ratingsChannel);
      if (accountDeletionChannel) supabase.removeChannel(accountDeletionChannel);
    };
  }, [isAdmin, activeTab, fetchAnalytics, fetchFeedbackData, fetchRatingsData, fetchAccountDeletionData]);

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
      const { data: { session } } = await supabase.auth.getSession();
      
      // Prepare context with analytics data and predictions
      const context = {
        totals: {
          users: analyticsData.totals?.users || 0,
          events: analyticsData.totals?.events || 0,
          transactions: analyticsData.totals?.transactions || 0,
          revenue_php: analyticsData.totals?.revenue_cents ? (analyticsData.totals.revenue_cents / 100).toFixed(2) : "0.00",
        },
        metrics: {
          user_growth_rate: analyticsData.additional_metrics?.user_growth_rate || 0,
          conversion_rate: analyticsData.additional_metrics?.conversion_rate || 0,
          avg_revenue_per_transaction_php: analyticsData.additional_metrics?.avg_revenue_per_transaction ? (analyticsData.additional_metrics.avg_revenue_per_transaction / 100).toFixed(2) : "0.00",
          most_popular_category: analyticsData.additional_metrics?.most_popular_category || "None",
        },
        transaction_rates: {
          paid_rate: analyticsData.transaction_rates?.paid_rate || 0,
          cancelled_rate: analyticsData.transaction_rates?.cancelled_rate || 0,
        },
        revenue_stats: {
          mean_php: analyticsData.revenue_stats?.mean ? (analyticsData.revenue_stats.mean / 100).toFixed(2) : "0.00",
          median_php: analyticsData.revenue_stats?.median ? (analyticsData.revenue_stats.median / 100).toFixed(2) : "0.00",
        },
        time_series_summary: analyticsData.time_series?.slice(-30).map((d: any) => ({
          date: d.date,
          revenue_php: d.revenue_cents ? (d.revenue_cents / 100).toFixed(2) : "0.00",
          users: d.users || 0,
          transactions: d.transactions || 0,
          events: d.events || 0,
        })) || [],
        predictions: predictionsData ? {
          trends: {
            revenue_growth_rate: predictionsData.trends?.revenue_growth_rate || 0,
            user_growth_rate: predictionsData.trends?.user_growth_rate || 0,
          },
          next_6_months_summary: predictionsData.predictions?.slice(0, 6).map((p: any) => ({
            month_year: p.month_year || p.date,
            predicted_revenue_php: p.predicted_revenue_cents ? (p.predicted_revenue_cents / 100).toFixed(2) : "0.00",
            predicted_users: p.predicted_users || 0,
            predicted_transactions: p.predicted_transactions || 0,
            predicted_events: p.predicted_events || 0,
          })) || [],
        } : null,
      };

      const prompt = `You are an analytics and predictive AI assistant for an events platform. Based on the provided analytics data, provide a comprehensive but CONCISE analysis in paragraph form (not bullet points) that includes:

**Current Performance Analysis**: Describe the current state of the platform including users, events, transactions, revenue (PHP format), conversion rate, average revenue per transaction, most popular category, and transaction rates (paid vs cancelled).

**Descriptive Analytics**: Analyze historical trends and patterns in the time series data, highlighting key observations about revenue distribution, user activity patterns, transaction frequency, and event creation trends.

**Predictive Insights**: Based on the trends and predictions provided, forecast what to expect in the next 6 months (monthly predictions) for revenue growth, user acquisition, transaction volume, and event creation. Include specific numbers and growth rates for each month.

**Risk Assessment**: Identify potential risks or concerns based on the data patterns.

**Strategic Recommendations**: Provide actionable recommendations to improve performance.

IMPORTANT: 
- All monetary values in the context are already in PHP (not cents). Use them directly with PHP currency format (e.g., PHP 1,350.00).
- Write in paragraph form (not bullet points) to reduce token usage.
- Be concise but comprehensive - summarize key insights efficiently.
- Use specific numbers and percentages where available.
- Keep the total response under 300 words while covering all aspects.`;

      const res = await fetch("/api/admin/insights", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          prompt,
          context,
        }),
      });

      const json = await res.json();
      if (res.ok) {
        setAiGeneratedInsight(json.text || "Insight generated successfully.");
      } else {
        toast.error(json.error || "Failed to generate insight");
        setAiGeneratedInsight("Failed to generate insight. Please try again.");
      }
    } catch (error: any) {
      console.error("Error generating AI insight:", error);
      toast.error(error.message || "Failed to generate insight");
      setAiGeneratedInsight("Failed to generate insight. Please try again.");
    } finally {
      setIsGeneratingInsight(false);
    }
  }, [analyticsData, predictionsData, isGeneratingInsight, supabase]);

  const getPieOuterRadius = useCallback(() => {
    if (windowWidth > 0 && windowWidth < 360) return 58;
    if (windowWidth > 0 && windowWidth < 480) return 66;
    if (windowWidth > 0 && windowWidth < 640) return 78;
    if (windowWidth > 0 && windowWidth < 1024) return 92;
    return 104;
  }, [windowWidth]);

  const getPieInnerRadius = useCallback(() => {
    if (windowWidth > 0 && windowWidth < 480) return 26;
    if (windowWidth > 0 && windowWidth < 640) return 34;
    if (windowWidth > 0 && windowWidth < 1024) return 40;
    return 46;
  }, [windowWidth]);

  const getPieChartHeight = useCallback(() => {
    if (windowWidth > 0 && windowWidth < 360) return 220;
    if (windowWidth > 0 && windowWidth < 480) return 240;
    if (windowWidth > 0 && windowWidth < 640) return 260;
    if (windowWidth > 0 && windowWidth < 1024) return 280;
    return 300;
  }, [windowWidth]);

  const pendingAccountDeletionCount = useMemo(() => {
    if (!accountDeletionData?.requests) return 0;
    return (accountDeletionData.requests as any[]).filter((item) => (item.status || "").toLowerCase() === "pending").length;
  }, [accountDeletionData]);

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
    <div className="w-full min-w-0 max-w-full">
      <div className="container mx-auto w-full max-w-[calc(100vw-1.5rem)] xl:max-w-6xl py-4 sm:py-6 lg:py-8 px-4 sm:px-6 min-w-0">
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

      <div className="border-b mb-4 sm:mb-6 px-3 sm:px-6 overflow-x-hidden">
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
          <div className="flex gap-2 sm:gap-4 pb-1 [&::-webkit-scrollbar]:hidden">
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
          {/* Users tab removed */}
          <button
            onClick={() => setActiveTab("roip")}
              className={`px-2 sm:px-3 md:px-4 py-2 text-xs sm:text-sm font-medium rounded-t-md transition-colors whitespace-nowrap flex-shrink-0 ${
              activeTab === "roip"
                ? "bg-background border-b-2 border-primary text-primary"
                : "hover:text-primary text-muted-foreground"
            }`}
          >
            ROIP
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
            <div className={`${loadingAnalytics ? "opacity-50 pointer-events-none" : ""} max-w-full`}>
              {/* Key Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 min-w-0">
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Events</div>
                    <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.events || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">Events created</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Active Subscriptions</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.active_subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    of {formatNumber(analyticsData.totals?.users || 0)} users
                  </div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Subscriptions</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(analyticsData.totals?.subscriptions || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">All subscription records</div>
                </div>
              </div>

              {/* Revenue Statistics */}
              <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6 min-w-0">
                <h3 className="text-base sm:text-lg font-semibold mb-4">Revenue Statistics</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50 min-w-0">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Mean (Average)</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mean || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Average transaction value</div>
                  </div>
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50 min-w-0">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Median</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.median || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Middle value</div>
                  </div>
                  <div className="rounded-lg border p-3 sm:p-4 bg-muted/50 min-w-0">
                    <div className="text-xs sm:text-sm text-muted-foreground mb-1">Mode (Most Common)</div>
                    <div className="text-xl sm:text-2xl font-bold">{formatCurrency(analyticsData.revenue_stats?.mode || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">Most frequent amount</div>
                  </div>
                </div>
              </div>

              {/* Time Series Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Events Over Time */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Events Created Over Time</h3>
                  <ResponsiveContainer width="100%" height={220}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">User Growth Over Time</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="users" stroke="#ec4899" strokeWidth={2} name="New Users" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Subscription Breakdown */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Most Popular Subscriptions */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Most Popular Subscriptions</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(analyticsData.subscription_breakdown || [])
                      .filter((item: any) => item.name !== "Free" && item.name !== "Trial Subscriber")
                      .map((item: any, idx: number) => ({ ...item, _index: idx }))}>
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
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Revenue by Subscription Plan</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={(analyticsData.subscription_breakdown || [])
                      .filter((item: any) => item.name !== "Free" && item.name !== "Trial Subscriber")
                      .map((item: any, idx: number) => ({ ...item, _index: idx }))}>
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

              {/* Daily Transactions by Plan */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Daily Transactions by Plan Line Chart */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Daily Transactions by Plan</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={analyticsData.time_series || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fill: '#64748b' }} />
                      <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend wrapperStyle={{ color: '#1e293b' }} />
                      <Line type="monotone" dataKey="small_event_org_transactions" stroke="#3b82f6" strokeWidth={2} name="Small Event Org" />
                      <Line type="monotone" dataKey="large_event_org_transactions" stroke="#10b981" strokeWidth={2} name="Large Event Org" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Subscription Distribution Pie Chart */}
                {mounted && analyticsData.subscription_breakdown && analyticsData.subscription_breakdown.length > 0 && (() => {
                const pieData = analyticsData.subscription_breakdown.map((entry: any, index: number) => ({
                  ...entry,
                  fill: COLORS[index % COLORS.length],
                }));
                console.log('Pie data colors:', pieData.map((d: any) => ({ name: d.name, fill: d.fill })));
                return (
                  <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6 min-w-0 overflow-visible">
                    <h3 className="text-base sm:text-lg font-semibold mb-4">Subscription Distribution</h3>
                    <ResponsiveContainer width="100%" height={getPieChartHeight()}>
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
                          outerRadius={getPieOuterRadius()}
                          innerRadius={getPieInnerRadius()}
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
              </div>

              {/* Event Creation Rate & Transaction Rates */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mt-4 sm:mt-6">
                {/* Event Creation Rate */}
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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
                  {analyticsData.popular_events_by_category && analyticsData.popular_events_by_category.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="text-sm font-medium mb-3">Category Rankings</div>
                      <div className="max-h-[300px] overflow-y-auto space-y-2">
                        {[...analyticsData.popular_events_by_category]
                          .sort((a: any, b: any) => (b.count || 0) - (a.count || 0))
                          .map((item: any, index: number) => (
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
                    <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-visible">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Transaction Rates</h3>
                      <ResponsiveContainer width="100%" height={getPieChartHeight()}>
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={(props: any) => `${props.name}: ${((props.percent || 0) * 100).toFixed(1)}%`}
                            outerRadius={getPieOuterRadius()}
                            innerRadius={getPieInnerRadius()}
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

              {/* Popular Events by Category */}
              {analyticsData.popular_events_by_category && analyticsData.popular_events_by_category.length > 0 && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6 min-w-0 overflow-hidden">
                  <h3 className="text-base sm:text-lg font-semibold mb-4">Popular Events by Category</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={analyticsData.popular_events_by_category.map((item: any, idx: number) => ({ ...item, _index: idx }))}>
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

              {/* Predictive Analytics Charts */}
              {predictionsData && predictionsData.predictions && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6 min-w-0">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold mb-1">Predictive Analytics (Next 6 Months)</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Monthly forecasts based on historical trends
                      </p>
                    </div>
                    {loadingPredictions && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        Updating predictions...
                      </div>
                    )}
                  </div>

                  {/* Data Quality Warning */}
                  {predictionsData.data_quality && predictionsData.data_quality.has_low_accuracy && (
                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-500/50 rounded-lg">
                      <div className="flex items-start gap-2">
                        <div className="text-amber-600 dark:text-amber-400 mt-0.5">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">Low Prediction Accuracy Warning</div>
                          <div className="text-xs text-amber-700 dark:text-amber-200/80">
                            {predictionsData.data_quality.message}. Predictions may have <strong>very low accuracy</strong> due to insufficient or inconsistent historical data. 
                            {predictionsData.data_quality.data_points > 0 && (
                              <span> Only {predictionsData.data_quality.data_points} data point{predictionsData.data_quality.data_points !== 1 ? 's' : ''} available.</span>
                            )}
                            {predictionsData.data_quality.data_points === 0 && (
                              <span> No historical data points available.</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Predicted Revenue */}
                    <div className="rounded-lg border p-4 bg-muted/50 min-w-0 overflow-hidden">
                      <h4 className="text-sm font-semibold mb-3">Predicted Revenue (Monthly)</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={[
                          ...(() => {
                            // Aggregate historical data by month
                            const monthlyData = new Map<string, { month_year: string; revenue: number }>();
                            (analyticsData.time_series || []).forEach((d: any) => {
                              if (!d.date) return;
                              const date = new Date(d.date);
                              const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                              const existing = monthlyData.get(monthYear) || { month_year: monthYear, revenue: 0 };
                              existing.revenue += d.revenue_cents || 0;
                              monthlyData.set(monthYear, existing);
                            });
                            return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                          })(),
                          ...(predictionsData.predictions || []).map((p: any) => ({
                            month_year: p.month_year || p.date,
                            revenue: p.predicted_revenue_cents || 0,
                            type: "Predicted"
                          }))
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month_year" className="text-xs" tick={{ fill: '#64748b' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis className="text-xs" tick={{ fill: '#64748b' }} tickFormatter={(value: unknown) => `₱${(Number(value as number) / 100).toFixed(0)}`} />
                          <Tooltip formatter={(value: any) => formatCurrency(Number(value))} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                          <Legend />
                          <Area type="monotone" dataKey="revenue" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Revenue" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Predicted User Growth */}
                    <div className="rounded-lg border p-4 bg-muted/50 min-w-0 overflow-hidden">
                      <h4 className="text-sm font-semibold mb-3">Predicted User Growth (Monthly)</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={[
                          ...(() => {
                            // Aggregate historical data by month
                            const monthlyData = new Map<string, { month_year: string; users: number }>();
                            (analyticsData.time_series || []).forEach((d: any) => {
                              if (!d.date) return;
                              const date = new Date(d.date);
                              const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                              const existing = monthlyData.get(monthYear) || { month_year: monthYear, users: 0 };
                              existing.users += d.users || 0;
                              monthlyData.set(monthYear, existing);
                            });
                            return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                          })(),
                          ...(predictionsData.predictions || []).map((p: any) => ({
                            month_year: p.month_year || p.date,
                            users: p.predicted_users || 0,
                            type: "Predicted"
                          }))
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month_year" className="text-xs" tick={{ fill: '#64748b' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                          <Legend />
                          <Area type="monotone" dataKey="users" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} name="New Users" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Predicted Transactions */}
                    <div className="rounded-lg border p-4 bg-muted/50 min-w-0 overflow-hidden">
                      <h4 className="text-sm font-semibold mb-3">Predicted Transactions (Monthly)</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={[
                          ...(() => {
                            // Aggregate historical data by month
                            const monthlyData = new Map<string, { month_year: string; transactions: number }>();
                            (analyticsData.time_series || []).forEach((d: any) => {
                              if (!d.date) return;
                              const date = new Date(d.date);
                              const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                              const existing = monthlyData.get(monthYear) || { month_year: monthYear, transactions: 0 };
                              existing.transactions += d.transactions || 0;
                              monthlyData.set(monthYear, existing);
                            });
                            return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                          })(),
                          ...(predictionsData.predictions || []).map((p: any) => ({
                            month_year: p.month_year || p.date,
                            transactions: p.predicted_transactions || 0,
                            type: "Predicted"
                          }))
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month_year" className="text-xs" tick={{ fill: '#64748b' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                          <Legend />
                          <Area type="monotone" dataKey="transactions" stroke="#10b981" fill="#10b981" fillOpacity={0.3} name="Transactions" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Predicted Events */}
                    <div className="rounded-lg border p-4 bg-muted/50 min-w-0 overflow-hidden">
                      <h4 className="text-sm font-semibold mb-3">Predicted Event Creation (Monthly)</h4>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={[
                          ...(() => {
                            // Aggregate historical data by month
                            const monthlyData = new Map<string, { month_year: string; events: number }>();
                            (analyticsData.time_series || []).forEach((d: any) => {
                              if (!d.date) return;
                              const date = new Date(d.date);
                              const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                              const existing = monthlyData.get(monthYear) || { month_year: monthYear, events: 0 };
                              existing.events += d.events || 0;
                              monthlyData.set(monthYear, existing);
                            });
                            return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                          })(),
                          ...(predictionsData.predictions || []).map((p: any) => ({
                            month_year: p.month_year || p.date,
                            events: p.predicted_events || 0,
                            type: "Predicted"
                          }))
                        ]}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="month_year" className="text-xs" tick={{ fill: '#64748b' }} angle={-45} textAnchor="end" height={80} />
                          <YAxis className="text-xs" tick={{ fill: '#64748b' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                          <Legend />
                          <Area type="monotone" dataKey="events" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Events" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Prediction Summary */}
                  {predictionsData.trends && (
                    <div className="mt-4 pt-4 border-t">
                      <h4 className="text-sm font-semibold mb-3">Prediction Summary</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Monthly Revenue</div>
                          <div className="text-lg font-semibold">{formatCurrency(predictionsData.trends.avg_monthly_revenue || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Monthly Users</div>
                          <div className="text-lg font-semibold">{formatNumber(predictionsData.trends.avg_monthly_users || 0)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Revenue Growth</div>
                          <div className={`text-lg font-semibold ${(predictionsData.trends.revenue_growth_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {predictionsData.trends.revenue_growth_rate?.toFixed(1) || "0.0"}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">User Growth</div>
                          <div className={`text-lg font-semibold ${(predictionsData.trends.user_growth_rate || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {predictionsData.trends.user_growth_rate?.toFixed(1) || "0.0"}%
                          </div>
                        </div>
                      </div>
                      
                      {/* Next Month Forecast */}
                      {predictionsData.predictions_summary && (
                        <div className="bg-muted/30 rounded-lg p-4 border">
                          <h5 className="text-xs font-semibold mb-3">Next Month Forecast</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                              <div className="text-xs text-muted-foreground">Predicted Revenue</div>
                              <div className="text-lg font-semibold text-green-600">{formatCurrency(predictionsData.predictions_summary.next_month_revenue || 0)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Predicted Users</div>
                              <div className="text-lg font-semibold">{formatNumber(predictionsData.predictions_summary.next_month_users || 0)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Predicted Transactions</div>
                              <div className="text-lg font-semibold">{formatNumber(predictionsData.predictions_summary.next_month_transactions || 0)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-muted-foreground">Predicted Events</div>
                              <div className="text-lg font-semibold">{formatNumber(predictionsData.predictions_summary.next_month_events || 0)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Next 6 Months Total */}
                      {predictionsData.predictions_summary && (
                        <div className="mt-4 pt-4 border-t">
                          <h5 className="text-xs font-semibold mb-2">Next 6 Months Total</h5>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-muted-foreground">Total Revenue</div>
                              <div className="text-sm font-semibold text-green-600">{formatCurrency(predictionsData.predictions_summary.next_6_months_total_revenue || 0)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Total Users</div>
                              <div className="text-sm font-semibold">{formatNumber(predictionsData.predictions_summary.next_6_months_total_users || 0)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Total Transactions</div>
                              <div className="text-sm font-semibold">{formatNumber(predictionsData.predictions_summary.next_6_months_total_transactions || 0)}</div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Total Events</div>
                              <div className="text-sm font-semibold">{formatNumber(predictionsData.predictions_summary.next_6_months_total_events || 0)}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* AI Insight + Descriptive Summary */}
              <div className="rounded-lg border p-4 sm:p-6 bg-card mt-4 sm:mt-6 min-w-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    <h3 className="text-base sm:text-lg font-semibold">AI Analytics Insight</h3>
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
                        Generate Analytics Insight
                      </>
                    )}
                  </Button>
                </div>
                {aiGeneratedInsight ? (
                  <div className="rounded-lg border p-4 bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{aiGeneratedInsight}</p>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">Click "Generate Analytics Insight" to get AI-powered analysis that includes descriptive analytics (current performance and historical trends) and predictive insights (forecasts for the next 30 days) in a concise paragraph format.</div>
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
        <div className="space-y-4 sm:space-y-6 min-w-0 max-w-full overflow-x-hidden">
          {loadingFeedback && !feedbackData ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                <div>Loading feedback analytics...</div>
              </div>
            </div>
          ) : feedbackData ? (
            <div className={`${loadingFeedback ? "opacity-50 pointer-events-none" : ""} max-w-full`}>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 min-w-0">
                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Total Feedback</div>
                    <Activity className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(feedbackData.total || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">All feedback entries</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs sm:text-sm font-medium text-muted-foreground">Feedback Types</div>
                    <Package className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold">{formatNumber(feedbackData.feedbackType?.length || 0)}</div>
                  <div className="text-xs text-muted-foreground mt-2">Unique types</div>
                </div>

                <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0">
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
                    <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Type</h3>
                      <ResponsiveContainer width="100%" height={getPieChartHeight()}>
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
                            outerRadius={getPieOuterRadius()}
                            innerRadius={getPieInnerRadius()}
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
                  <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
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
                    <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-visible">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Rating</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={getPieChartHeight()}>
                            <PieChart>
                              <Pie
                                data={feedbackData.rating.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={getPieOuterRadius()}
                                innerRadius={getPieInnerRadius()}
                                dataKey="value"
                                label={(props: any) => `${props.name}: ${(props.percent * 100).toFixed(1)}%`}
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
                  <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
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
                    <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-visible">
                      <h3 className="text-base sm:text-lg font-semibold mb-4">Feedback by Status</h3>
                      <div className="flex items-center gap-4">
                        <div className="flex-1" style={{ maxWidth: '60%' }}>
                          <ResponsiveContainer width="100%" height={getPieChartHeight()}>
                            <PieChart>
                              <Pie
                                data={feedbackData.status.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={getPieOuterRadius()}
                                innerRadius={getPieInnerRadius()}
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
                  <div className="rounded-lg border p-4 sm:p-6 bg-card min-w-0 overflow-hidden">
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
                          <ResponsiveContainer width="100%" height={getPieChartHeight()}>
                            <PieChart>
                              <Pie
                                data={feedbackData.priority.map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={getPieOuterRadius()}
                                innerRadius={getPieInnerRadius()}
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
      {/* Users tab and account deletion management removed */}
      {activeTab === "roip" && (
        <div className="min-w-0 max-w-full space-y-4 sm:space-y-6">
          {loadingRoip ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Loading ROIP data...
            </div>
          ) : roipError ? (
            <div className="flex h-[60vh] flex-col items-center justify-center gap-4 text-sm">
              <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
                <p className="font-semibold">Error loading ROIP data</p>
                <p className="mt-2 text-xs">{roipError}</p>
                <button
                  onClick={() => fetchRoipData()}
                  className="mt-4 rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : roipData ? (
            <>
              {/* Summary Cards */}
              <RoipSummaryCards roipData={roipData} formatCurrency={formatCurrency} />

              {/* Cost Management Section */}
              <div className="rounded-lg border p-4 sm:p-6 bg-card">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-base sm:text-lg font-semibold">Cost Management</h3>
                  <Button onClick={() => setShowCostDialog(true)} className="w-full sm:w-auto">
                    Add Cost
                  </Button>
                </div>

                {loadingCosts ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    Loading costs...
                  </div>
                ) : costsError ? (
                  <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive text-sm">
                    <p>{costsError}</p>
                    <button
                      onClick={() => fetchAdminCosts()}
                      className="mt-2 rounded-md bg-destructive px-3 py-1.5 text-xs text-destructive-foreground hover:bg-destructive/90"
                    >
                      Retry
                    </button>
                  </div>
                ) : adminCosts.length === 0 ? (
                  <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                    No costs recorded yet. Add your first cost to start tracking.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Type</th>
                          <th className="text-left p-2">Description</th>
                          <th className="text-right p-2">Amount</th>
                          <th className="text-left p-2">Date</th>
                          <th className="text-right p-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminCosts.map((cost: any) => (
                          <tr key={cost.id} className="border-b hover:bg-muted/50">
                            <td className="p-2 capitalize">{cost.cost_type}</td>
                            <td className="p-2">{cost.description || "-"}</td>
                            <td className="p-2 text-right font-medium">{formatCurrency(cost.amount_cents || 0)}</td>
                            <td className="p-2">{new Date(cost.date_incurred).toLocaleDateString()}</td>
                            <td className="p-2 text-right">
                              <button
                                onClick={() => handleDeleteCost(cost.id)}
                                className="text-destructive hover:text-destructive/80 text-xs"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ROI Prediction Chart */}
              {roipData.historical && roipData.predictions && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold mb-1">ROI Prediction Chart</h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        {roipData.method === "cohere_ai" ? "AI-powered prediction using Cohere" : "Trend-based prediction"}
                      </p>
                    </div>
                    <Button onClick={() => fetchRoipData()} variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh
                    </Button>
                  </div>

                  {/* Warning for insufficient historical data */}
                  {(() => {
                    const historicalDataCount = roipData.historical?.length || 0;
                    const isInsufficientData = historicalDataCount < 3;
                    const hasNoData = historicalDataCount === 0;
                    
                    if (isInsufficientData || hasNoData) {
                      return (
                        <div className="mb-4 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                          <div className="flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm mb-1 text-yellow-900 dark:text-yellow-100">
                                Low Prediction Accuracy Warning
                              </h4>
                              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                                {hasNoData 
                                  ? "No historical data available. Predictions are based on limited information and may have low accuracy. Please add transaction and cost data to improve prediction reliability."
                                  : `Only ${historicalDataCount} month${historicalDataCount === 1 ? '' : 's'} of historical data available. Predictions may have low accuracy. We recommend having at least 3 months of historical data for more reliable predictions.`
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Break-even Information */}
                  {(() => {
                    // Calculate break-even point (when ROI becomes positive)
                    const allData = [
                      ...(roipData.historical || []).map((h: any) => ({
                        month: h.month,
                        roi: h.revenue > 0 ? ((h.revenue - h.costs) / h.revenue) * 100 : 0,
                      })),
                      ...(roipData.predictions || []).map((p: any) => ({
                        month: p.month,
                        roi: p.predicted_roi || 0,
                      }))
                    ];
                    
                    // Find first point where ROI >= 0
                    let breakEvenPoint: any = allData.find((d: any) => d.roi >= 0);
                    
                    if (!breakEvenPoint) {
                      // If no positive ROI found, check if trend is improving
                      const lastHistorical = roipData.historical?.[roipData.historical.length - 1];
                      const lastPrediction = roipData.predictions?.[roipData.predictions.length - 1];
                      
                      if (lastPrediction && lastPrediction.predicted_roi < 0) {
                        // Check if trend is improving
                        const historicalRoi = lastHistorical?.revenue > 0 
                          ? ((lastHistorical.revenue - lastHistorical.costs) / lastHistorical.revenue) * 100 
                          : 0;
                        const trendImproving = lastPrediction.predicted_roi > historicalRoi;
                        
                        if (trendImproving) {
                          // Estimate break-even based on trend
                          const roiDiff = lastPrediction.predicted_roi - historicalRoi;
                          if (roiDiff > 0 && roipData.predictions.length > 0) {
                            const monthsToBreakEven = Math.ceil(Math.abs(lastPrediction.predicted_roi) / (roiDiff / roipData.predictions.length));
                            const lastMonth = new Date(lastPrediction.month + '-01');
                            lastMonth.setMonth(lastMonth.getMonth() + monthsToBreakEven);
                            const estimatedMonth = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
                            breakEvenPoint = { month: estimatedMonth, roi: 0, estimated: true };
                          }
                        }
                      }
                    }
                    
                    if (breakEvenPoint) {
                      return (
                        <div className="mb-4 rounded-lg border border-blue-500/50 bg-blue-500/10 p-4">
                          <div className="flex items-start gap-3">
                            <Target className="h-5 w-5 text-blue-600 dark:text-blue-500 flex-shrink-0 mt-0.5" />
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm mb-1 text-blue-900 dark:text-blue-100">
                                Expected Investment Return
                              </h4>
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                {breakEvenPoint.estimated 
                                  ? `Based on current trends, ROI is expected to reach break-even (0%) around ${breakEvenPoint.month}. This is an estimated projection.`
                                  : `ROI is predicted to reach break-even (0% or positive) in ${breakEvenPoint.month}. This indicates when you can expect to recover your investment and start generating positive returns.`
                                }
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {mounted && (
                    <RoipChart
                      historical={roipData.historical || []}
                      predictions={roipData.predictions || []}
                      windowWidth={windowWidth}
                      formatCurrency={formatCurrency}
                      predictionType={roipData.prediction_type || 'monthly'}
                    />
                  )}

                  {/* Prediction Table */}
                  <div className="mt-6 overflow-x-auto">
                    <h4 className="text-sm font-semibold mb-3">
                      {roipData.prediction_type === 'daily' ? 'Daily Predictions (Next 14 Days)' : 'Monthly Predictions (Next 6 Months)'}
                    </h4>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">{roipData.prediction_type === 'daily' ? 'Date' : 'Month'}</th>
                          <th className="text-right p-2">Predicted Revenue</th>
                          <th className="text-right p-2">Predicted Costs</th>
                          <th className="text-right p-2">Predicted ROI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roipData.predictions.map((pred: any, idx: number) => {
                          // Format date/month for display
                          let displayDate = pred.month || pred.date || '';
                          if (roipData.prediction_type === 'daily' && displayDate.includes('-')) {
                            // Format YYYY-MM-DD to a readable date
                            try {
                              const date = new Date(displayDate);
                              displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                            } catch (e) {
                              // Keep original format if parsing fails
                            }
                          } else if (roipData.prediction_type === 'monthly' && displayDate.includes('-')) {
                            // Format YYYY-MM to Month Year
                            try {
                              const [year, month] = displayDate.split('-');
                              const date = new Date(parseInt(year), parseInt(month) - 1);
                              displayDate = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                            } catch (e) {
                              // Keep original format if parsing fails
                            }
                          }
                          
                          return (
                            <tr key={idx} className="border-b hover:bg-muted/50">
                              <td className="p-2">{displayDate}</td>
                              <td className="p-2 text-right font-medium">{formatCurrency(pred.predicted_revenue || 0)}</td>
                              <td className="p-2 text-right">{formatCurrency(pred.predicted_costs || 0)}</td>
                              <td className={`p-2 text-right font-medium ${(pred.predicted_roi || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {pred.predicted_roi?.toFixed(2) || "0.00"}%
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* AI Prediction Section */}
              {roipData.historical && roipData.predictions && (
                <div className="rounded-lg border p-4 sm:p-6 bg-card">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold mb-1 flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-yellow-500" />
                        AI Prediction Insight
                      </h3>
                      <p className="text-xs sm:text-sm text-muted-foreground">
                        Get AI-powered strategic analysis of your ROI predictions and trends
                      </p>
                    </div>
                    <Button 
                      onClick={generateRoipPredictionInsight}
                      disabled={isGeneratingRoipInsight || !roipData}
                      variant="default"
                      size="sm"
                      className="bg-primary text-primary-foreground hover:bg-primary/90"
                    >
                      {isGeneratingRoipInsight ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Lightbulb className="h-4 w-4 mr-2" />
                          Generate Prediction Insight
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Prediction Insight Display */}
                  {roipPredictionInsight ? (
                    <div className="rounded-lg border p-4 sm:p-6 bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-950/20 dark:to-orange-950/20">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-6 w-6 text-yellow-500 flex-shrink-0 mt-1" />
                        <div className="flex-1">
                          <h4 className="font-semibold text-base mb-3">AI Strategic Analysis</h4>
                          <div className="prose prose-sm max-w-none">
                            <p className="text-sm sm:text-base text-foreground whitespace-pre-wrap leading-relaxed">
                              {roipPredictionInsight}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed p-8 text-center bg-muted/30">
                      <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                      <p className="text-sm sm:text-base text-muted-foreground mb-2">
                        No prediction insight generated yet
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Click "Generate Prediction Insight" to get AI-powered analysis of your ROI predictions, trends, and actionable recommendations.
                      </p>
                    </div>
                  )}

                  {roipData.analysis && (
                    <div className="mt-4 p-4 rounded-md bg-muted/50 border border-muted">
                      <p className="font-medium mb-2 text-sm">Quick Analysis:</p>
                      <p className="text-sm text-muted-foreground">{roipData.analysis}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              No ROIP data available
            </div>
          )}

          {/* Add Cost Dialog */}
          <Dialog open={showCostDialog} onOpenChange={setShowCostDialog}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Add New Cost</DialogTitle>
                <DialogDescription>
                  Record an operational cost to improve ROI predictions.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Cost Type</label>
                  <select
                    value={newCost.cost_type}
                    onChange={(e) => setNewCost({ ...newCost, cost_type: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="repair">Repair</option>
                    <option value="expansion">Expansion</option>
                    <option value="hosting">Hosting</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Description</label>
                  <input
                    type="text"
                    value={newCost.description}
                    onChange={(e) => setNewCost({ ...newCost, description: e.target.value })}
                    placeholder="e.g., Website maintenance, Server upgrade"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Amount (PHP)</label>
                  <input
                    type="number"
                    value={newCost.amount_cents / 100}
                    onChange={(e) => setNewCost({ ...newCost, amount_cents: Math.round(parseFloat(e.target.value) * 100) || 0 })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date Incurred</label>
                  <input
                    type="date"
                    value={newCost.date_incurred}
                    onChange={(e) => setNewCost({ ...newCost, date_incurred: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCostDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddCost} disabled={submittingCost}>
                  {submittingCost ? "Adding..." : "Add Cost"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
      {activeTab === "rating" && (
        <div className="min-w-0 max-w-full">
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
            <div className="max-w-full">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4 lg:gap-4 min-w-0">
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
                          <ResponsiveContainer width="100%" height={getPieChartHeight()}>
                            <PieChart>
                              <Pie
                                data={ratingsData.rating.filter((item: any) => item.count > 0).map((item: any, index: number) => ({
                                  ...item,
                                  fill: COLORS[index % COLORS.length],
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={getPieOuterRadius()}
                                innerRadius={getPieInnerRadius()}
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
    </div>
  );
}
