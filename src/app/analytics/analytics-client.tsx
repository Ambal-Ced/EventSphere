"use client";

// Client component for interactive analytics features

import { useEffect, useMemo, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";
import { useRouter } from "next/navigation";
import { useThemePreference } from "@/hooks/use-theme-preference";

// Lazy-load Recharts bits client-side only
const loadingBox = (h: number = 300) => <div style={{ height: h }} className="w-full animate-pulse rounded bg-slate-700/40" />;
const ResponsiveContainer: any = dynamic(() => import("recharts").then(m => m.ResponsiveContainer as any), { ssr: false, loading: () => loadingBox() }) as any;
const BarChart: any = dynamic(() => import("recharts").then(m => m.BarChart as any), { ssr: false }) as any;
const Bar: any = dynamic(() => import("recharts").then(m => m.Bar as any), { ssr: false }) as any;
const XAxis: any = dynamic(() => import("recharts").then(m => m.XAxis as any), { ssr: false }) as any;
const YAxis: any = dynamic(() => import("recharts").then(m => m.YAxis as any), { ssr: false }) as any;
const CartesianGrid: any = dynamic(() => import("recharts").then(m => m.CartesianGrid as any), { ssr: false }) as any;
const Tooltip: any = dynamic(() => import("recharts").then(m => m.Tooltip as any), { ssr: false }) as any;
const Legend: any = dynamic(() => import("recharts").then(m => m.Legend as any), { ssr: false }) as any;
const PieChart: any = dynamic(() => import("recharts").then(m => m.PieChart as any), { ssr: false }) as any;
const Pie: any = dynamic(() => import("recharts").then(m => m.Pie as any), { ssr: false }) as any;
const Cell: any = dynamic(() => import("recharts").then(m => m.Cell as any), { ssr: false }) as any;
const LineChart: any = dynamic(() => import("recharts").then(m => m.LineChart as any), { ssr: false }) as any;
const Line: any = dynamic(() => import("recharts").then(m => m.Line as any), { ssr: false }) as any;
const ScatterChart: any = dynamic(() => import("recharts").then(m => m.ScatterChart as any), { ssr: false }) as any;
const Scatter: any = dynamic(() => import("recharts").then(m => m.Scatter as any), { ssr: false }) as any;
const ZAxis: any = dynamic(() => import("recharts").then(m => m.ZAxis as any), { ssr: false }) as any;
const AreaChart: any = dynamic(() => import("recharts").then(m => m.AreaChart as any), { ssr: false }) as any;
const Area: any = dynamic(() => import("recharts").then(m => m.Area as any), { ssr: false }) as any;

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

type EventRow = {
  id: string;
  title: string;
  date: string | null;
  user_id: string;
  category?: string;
  markup_type?: "percentage" | "fixed";
  markup_value?: number;
  discount_type?: "none" | "percentage" | "fixed";
  discount_value?: number;
};

type EventItem = {
  event_id: string;
  cost?: number;
  item_quantity?: number;
};

interface AnalyticsClientProps {
  initialEvents: EventRow[];
  initialItems: EventItem[];
  initialAttStats: { event_id: string; expected_attendees: number; event_attendees: number }[];
  initialFeedback: { event_id: string; rating: number; sentiment?: string }[];
}

export default function AnalyticsClient({
  initialEvents,
  initialItems,
  initialAttStats,
  initialFeedback,
}: AnalyticsClientProps) {
  const router = useRouter();
  const themePreference = useThemePreference();
  const isLightTheme = themePreference === "light";
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [scope, setScope] = useState<"owned" | "joined" | "both">("both");
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showStuckRefresh, setShowStuckRefresh] = useState(false);
  const [events, setEvents] = useState<EventRow[]>(initialEvents);
  const [items, setItems] = useState<EventItem[]>(initialItems);
  const [attStats, setAttStats] = useState<{ event_id: string; expected_attendees: number; event_attendees: number }[]>(initialAttStats);
  const [feedback, setFeedback] = useState<{ event_id: string; rating: number; sentiment?: string }[]>(initialFeedback);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expMin, setExpMin] = useState<string>('');
  const [expMax, setExpMax] = useState<string>('');
  const [actMin, setActMin] = useState<string>('');
  const [actMax, setActMax] = useState<string>('');

  const fetchAnalyticsData = useCallback(
    async (targetScope: "owned" | "joined" | "both", uid: string) => {
      setLoading(true);
      setError(null);
      try {
        let ownedEvents: EventRow[] = [];
        if (targetScope !== "joined") {
          const { data, error } = await supabase
            .from("events")
            .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
            .eq("user_id", uid);
          if (error) throw error;
          ownedEvents = (data || []) as any;
        }

        let joinedEvents: EventRow[] = [];
        if (targetScope !== "owned") {
          const { data: collabRows, error: collabError } = await supabase
            .from("event_collaborators")
            .select("event_id")
            .eq("user_id", uid);
          if (collabError) throw collabError;
          let joinedIds: string[] = (collabRows || []).map((r: any) => r.event_id);
          if (joinedIds.length === 0) {
            const { data: rpcData, error: rpcError } = await supabase.rpc("get_user_collaborations", { p_user_id: uid });
            if (rpcError) throw rpcError;
            joinedIds = (rpcData || []).map((r: any) => r.event_id || r.id).filter(Boolean);
          }
          if (joinedIds.length > 0) {
            const { data: joined, error: joinedError } = await supabase
              .from("events")
              .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
              .in("id", joinedIds);
            if (joinedError) throw joinedError;
            joinedEvents = (joined || []) as any;
          }
        }

        const all = targetScope === "owned"
          ? ownedEvents
          : targetScope === "joined"
          ? joinedEvents
          : Array.from(new Map([...ownedEvents, ...joinedEvents].map((e: any) => [e.id, e])).values());

        setEvents(all);

        if (all.length > 0) {
          const [itemsResult, attResult, fbResult] = await Promise.all([
            supabase.from("event_items").select("event_id,cost,item_quantity").in("event_id", all.map((e) => e.id)),
            supabase.from("attendees").select("event_id,expected_attendees,event_attendees").in("event_id", all.map((e) => e.id)),
            supabase.from("feedback_responses").select("event_id,rating,sentiment").in("event_id", all.map((e) => e.id)),
          ]);

          setItems((itemsResult.data || []) as EventItem[]);
          setAttStats((attResult.data || []) as any);
          setFeedback((fbResult.data || []) as any);
        } else {
          setItems([]);
          setAttStats([]);
          setFeedback([]);
        }
      } catch (e: any) {
        console.error("Failed to load analytics:", e);
        setError(e.message || "Failed to load analytics");
        setEvents([]);
        setItems([]);
        setAttStats([]);
        setFeedback([]);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const ensureAuth = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error("Failed to get session:", error);
      }
      const sessionUser = data?.session?.user;
      if (!sessionUser) {
        router.replace("/login");
        return;
      }
      setUserId(sessionUser.id);
    };
    ensureAuth();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id) {
        setUserId(session.user.id);
      } else {
        router.replace("/login");
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    if (!userId) return;
    fetchAnalyticsData(scope, userId);
  }, [userId, scope, refreshNonce, fetchAnalyticsData]);

  // Show a retry button if still loading after 120s
  useEffect(() => {
    if (!loading) {
      setShowStuckRefresh(false);
      return;
    }
    const id = setTimeout(() => setShowStuckRefresh(true), 120000);
    return () => clearTimeout(id);
  }, [loading, scope, refreshNonce]);

  // Apply filters
  const visible = useMemo(() => {
    if (events.length === 0) return { events: [] as EventRow[], ids: new Set<string>() };
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : -Infinity;
    const toTs = dateTo ? new Date(dateTo).getTime() : Infinity;
    const eMin = expMin ? parseInt(expMin) : -Infinity;
    const eMax = expMax ? parseInt(expMax) : Infinity;
    const aMin = actMin ? parseInt(actMin) : -Infinity;
    const aMax = actMax ? parseInt(actMax) : Infinity;
    const filtered = events.filter(ev => {
      const ts = ev.date ? new Date(ev.date).getTime() : 0;
      if (ts < fromTs || ts > toTs) return false;
      if (typeFilter !== 'all' && ev.category !== typeFilter) return false;
      const att = attStats.find(a => a.event_id === ev.id);
      const exp = att?.expected_attendees ?? 0;
      const act = att?.event_attendees ?? 0;
      if (!(exp >= eMin && exp <= eMax)) return false;
      if (!(act >= aMin && act <= aMax)) return false;
      return true;
    });
    return { events: filtered, ids: new Set(filtered.map(e=>e.id)) };
  }, [events, attStats, typeFilter, dateFrom, dateTo, expMin, expMax, actMin, actMax]);

  const aggregates = useMemo(() => {
    if (visible.events.length === 0) return null;
    const byEventId = new Map<string, { totalCost: number; itemCount: number }>();
    for (const it of items.filter(i=>visible.ids.has(i.event_id))) {
      const key = it.event_id;
      const prev = byEventId.get(key) || { totalCost: 0, itemCount: 0 };
      prev.totalCost += (it.cost || 0) * (it.item_quantity || 1);
      prev.itemCount += 1;
      byEventId.set(key, prev);
    }

    let totalItemCost = 0;
    let totalEvents = visible.events.length;
    let totalItems = 0;
    let estRevenue = 0;
    let expectedTotal = 0;
    let actualTotal = 0;
    let ratings: number[] = [];

    for (const ev of visible.events) {
      const m = byEventId.get(ev.id) || { totalCost: 0, itemCount: 0 };
      totalItemCost += m.totalCost;
      totalItems += m.itemCount;
      const markup = ev.markup_type === "percentage" ? (m.totalCost * (ev.markup_value || 0) / 100) : (ev.markup_value || 0);
      const priceAfterMarkup = m.totalCost + markup;
      const discount = ev.discount_type === "percentage" ? (priceAfterMarkup * (ev.discount_value || 0) / 100) : (ev.discount_type === "fixed" ? (ev.discount_value || 0) : 0);
      const finalPrice = Math.max(0, priceAfterMarkup - discount);
      estRevenue += finalPrice;
      const att = attStats.find((a) => a.event_id === ev.id);
      expectedTotal += att?.expected_attendees || 0;
      actualTotal += att?.event_attendees || 0;
      ratings.push(
        ...feedback
          .filter((r) => r.event_id === ev.id && typeof r.rating === 'number')
          .map((r) => r.rating)
      );
    }

    return {
      totalEvents,
      totalItems,
      totalItemCost,
      estRevenue,
      byEventId,
      avgItemsPerEvent: totalEvents > 0 ? totalItems / totalEvents : 0,
      avgCostPerEvent: totalEvents > 0 ? totalItemCost / totalEvents : 0,
      expectedTotal,
      actualTotal,
      avgRating: ratings.length ? ratings.reduce((a,b)=>a+b,0)/ratings.length : 0,
    };
  }, [visible, items, attStats, feedback]);

  // Build simple chart data (top 10 by cost)
  const costChartData = useMemo(() => {
    if (!aggregates) return [] as { name: string; cost: number }[];
    const arr = visible.events.map((ev) => ({ name: ev.title, cost: aggregates.byEventId.get(ev.id)?.totalCost || 0 }));
    return arr.sort((a, b) => b.cost - a.cost).slice(0, 10);
  }, [aggregates, visible.events]);

  // Pie chart data for attendance distribution (Expected vs Actual)
  const attendancePie = useMemo(() => {
    if (!aggregates) return [] as any[];
    return [
      { name: 'Expected', value: aggregates.expectedTotal, fill: '#6366f1' },
      { name: 'Actual', value: aggregates.actualTotal, fill: '#22c55e' },
    ];
  }, [aggregates]);

  // Line chart data for cost per event over time (by date)
  const lineData = useMemo(() => {
    const map: { name: string; date: number; cost: number }[] = visible.events.map((ev) => ({
      name: ev.title,
      date: ev.date ? new Date(ev.date).getTime() : 0,
      cost: aggregates?.byEventId.get(ev.id)?.totalCost || 0,
    }));
    return map.sort((a, b) => a.date - b.date);
  }, [visible.events, aggregates]);

  // Scatter plot: cost vs expected attendees per event
  const scatterData = useMemo(() => {
    return visible.events.map((ev) => ({
      name: ev.title,
      x: aggregates?.byEventId.get(ev.id)?.totalCost || 0,
      y: (attStats.find((a) => a.event_id === ev.id)?.expected_attendees) || 0,
    }));
  }, [visible.events, aggregates, attStats]);

  // AI Insights with usage tracking
  const [aiInsights, setAiInsights] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [insightsUsageInfo, setInsightsUsageInfo] = useState<{
    insightsGenerated: number;
    canGenerateMore: boolean;
    weekStart: string;
    maxInsights: number;
  } | null>(null);
  
  // Predictive analytics
  const [predictionsData, setPredictionsData] = useState<any>(null);
  const [loadingPredictions, setLoadingPredictions] = useState(false);

  // Fetch insights usage info
  const fetchInsightsUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await DefaultSubscriptionManager.ensureUserHasSubscription(user.id);
      
      const { data: subscription, error: subError } = await supabase
        .from("user_subscriptions")
        .select(`
          *,
          subscription_plans (
            name
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (subError) {
        console.error("❌ Error fetching subscription:", subError);
        return;
      }

      const planName = (subscription?.subscription_plans as any)?.name || "Free Tier";
      const subscriptionFeatures = DefaultSubscriptionManager.getSubscriptionFeatures(planName);
      const maxAIInsightsOverall = subscriptionFeatures.max_ai_insights_overall;

      const { data, error } = await supabase.rpc('get_or_create_analytics_insights_weekly_usage', {
        p_user_id: user.id
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const usage = data[0];
        setInsightsUsageInfo({
          insightsGenerated: usage.insights_generated,
          canGenerateMore: usage.insights_generated < maxAIInsightsOverall,
          weekStart: usage.week_start_date_return,
          maxInsights: maxAIInsightsOverall
        });
      }
    } catch (error) {
      console.error('Error fetching insights usage info:', error);
    }
  };

  // Increment insights usage
  const incrementInsightsUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !insightsUsageInfo) return;

      const { error } = await supabase
        .from('analytics_insights_usage')
        .update({ insights_generated: insightsUsageInfo.insightsGenerated + 1 })
        .eq('user_id', user.id)
        .eq('week_start_date', insightsUsageInfo.weekStart);

      if (error) throw error;

      setInsightsUsageInfo(prev => prev ? {
        ...prev,
        insightsGenerated: prev.insightsGenerated + 1,
        canGenerateMore: prev.insightsGenerated + 1 < prev.maxInsights
      } : null);
    } catch (error) {
      console.error('Error incrementing insights usage:', error);
      throw error;
    }
  };

  // Save insights to database
  const saveInsightsToDatabase = async (insights: string) => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !insightsUsageInfo?.weekStart) return false;

      const { error } = await supabase
        .from('analytics_insights')
        .upsert({
          user_id: user.id,
          insights: insights,
          generated_at: new Date().toISOString(),
          week_start_date: insightsUsageInfo.weekStart
        }, {
          onConflict: 'user_id,week_start_date'
        });

      if (error) {
        console.error('Error saving insights:', error);
        return false;
      }
      
      setLastSaved(new Date());
      return true;
    } catch (error) {
      console.error('Error saving insights to database:', error);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const generateInsights = async () => {
    if (!aggregates || !insightsUsageInfo?.canGenerateMore) return;
    
    setIsGenerating(true);
    try {
      await incrementInsightsUsage();

      // Prepare context for Cohere AI
      const context = {
        totals: {
          events: aggregates.totalEvents,
          items: aggregates.totalItems,
          total_cost_php: aggregates.totalItemCost.toFixed(2),
          estimated_revenue_php: aggregates.estRevenue.toFixed(2),
          avg_cost_per_event_php: aggregates.avgCostPerEvent.toFixed(2),
          avg_items_per_event: aggregates.avgItemsPerEvent.toFixed(2),
        },
        attendance: {
          expected_total: aggregates.expectedTotal,
          actual_total: aggregates.actualTotal,
          attendance_rate: aggregates.expectedTotal > 0 ? ((aggregates.actualTotal / aggregates.expectedTotal) * 100).toFixed(1) : "0.0",
          avg_rating: aggregates.avgRating.toFixed(2),
        },
        top_events: costChartData.slice(0, 5).map((item: any) => ({
          name: item.name,
          cost_php: item.cost.toFixed(2),
        })),
        descriptive_analytics: {
          time_series_summary: lineData.slice(-30).map((d: any) => ({
            date: new Date(d.date).toISOString().split('T')[0],
            cost_php: d.cost.toFixed(2),
          })),
          cost_trends: {
            highest_cost_event: costChartData.length > 0 ? {
              name: costChartData[0].name,
              cost_php: costChartData[0].cost.toFixed(2),
            } : null,
            lowest_cost_event: costChartData.length > 0 ? {
              name: costChartData[costChartData.length - 1].name,
              cost_php: costChartData[costChartData.length - 1].cost.toFixed(2),
            } : null,
          },
          revenue_analysis: {
            total_revenue_php: aggregates.estRevenue.toFixed(2),
            avg_revenue_per_event_php: aggregates.totalEvents > 0 ? (aggregates.estRevenue / aggregates.totalEvents).toFixed(2) : "0.00",
            profit_margin_php: (aggregates.estRevenue - aggregates.totalItemCost).toFixed(2),
            profit_margin_percent: aggregates.estRevenue > 0 ? (((aggregates.estRevenue - aggregates.totalItemCost) / aggregates.estRevenue) * 100).toFixed(1) : "0.0",
          },
        },
        predictions: predictionsData ? {
          trends: {
            cost_growth_rate: predictionsData.trends?.cost_growth_rate || 0,
            revenue_growth_rate: predictionsData.trends?.revenue_growth_rate || 0,
            avg_daily_cost_php: predictionsData.trends?.avg_daily_cost?.toFixed(2) || "0.00",
            avg_daily_revenue_php: predictionsData.trends?.avg_daily_revenue?.toFixed(2) || "0.00",
            avg_daily_events: predictionsData.trends?.avg_daily_events?.toFixed(2) || "0.00",
            avg_daily_expected_attendees: predictionsData.trends?.avg_daily_expected_attendees?.toFixed(0) || "0",
          },
          next_30_days_summary: predictionsData.predictions?.slice(0, 5).map((p: any) => ({
            date: p.date,
            predicted_cost_php: p.predicted_cost?.toFixed(2) || "0.00",
            predicted_revenue_php: p.predicted_revenue?.toFixed(2) || "0.00",
            predicted_events: p.predicted_events || 0,
            predicted_expected_attendees: p.predicted_expected_attendees || 0,
          })) || [],
        } : null,
      };

      const prompt = `You are an analytics and predictive AI assistant for an event management platform. Based on the provided event analytics data, provide a comprehensive but CONCISE analysis in paragraph form (not bullet points) that includes:

**Current Performance Analysis**: Describe the current state of the user's events including total events, items managed, total costs (PHP format), estimated revenue (PHP format), average cost per event, average items per event, attendance metrics (expected vs actual), and average rating.

**Descriptive Analytics**: Analyze historical trends and patterns in the time series data, highlighting key observations about cost distribution over time, revenue patterns, event creation frequency, and attendance trends. Identify any notable patterns, spikes, or anomalies in the historical data.

**Predictive Insights**: Based on the trends and predictions provided, forecast what to expect in the next 30 days for event costs, estimated revenue, event creation frequency, and expected attendance. Include specific numbers, growth rates, and projected values where available.

**Risk Assessment**: Identify potential risks or concerns based on the data patterns (e.g., high costs, low attendance, pricing issues, cost growth trends).

**Strategic Recommendations**: Provide actionable recommendations to improve event profitability, reduce costs, increase attendance, and optimize pricing strategies.

IMPORTANT: 
- All monetary values in the context are already in PHP (not cents). Use them directly with PHP currency format (e.g., PHP 1,350.00).
- Write in paragraph form (not bullet points) to reduce token usage.
- Be concise but comprehensive - summarize key insights efficiently.
- Use specific numbers and percentages where available.
- Keep the total response under 300 words while covering all aspects.`;

      const { data: { session } } = await supabase.auth.getSession();
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
        const insightsText = json.text || "Insight generated successfully.";
        setAiInsights(insightsText);
        await saveInsightsToDatabase(insightsText);
      } else {
        console.error('Failed to generate insights:', json);
        // Fallback to simple descriptive text
        const top = costChartData[0];
        const text = `Overview: ${aggregates.totalEvents} events, ${aggregates.totalItems} items; total cost PHP ${aggregates.totalItemCost.toFixed(2)}, est. revenue PHP ${aggregates.estRevenue.toFixed(2)}. Pricing: average cost/event PHP ${aggregates.avgCostPerEvent.toFixed(2)}; top cost event "${top ? top.name : 'N/A'}" at PHP ${(top?.cost || 0).toFixed(2)}. Recommendations: audit high-cost events, align markup/discount to target margins, and standardize item templates to reduce variance.`;
        setAiInsights(text);
        await saveInsightsToDatabase(text);
      }
    } catch (error) {
      console.error('Error generating insights:', error);
      setAiInsights('Failed to generate insights. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Fetch predictions
  const fetchPredictions = useCallback(async () => {
    if (!events || events.length === 0) return;
    
    setLoadingPredictions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/analytics/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          events,
          items,
          attStats,
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
  }, [events, items, attStats]);

  useEffect(() => {
    if (events && events.length > 0) {
      fetchPredictions();
    }
  }, [events, fetchPredictions]);

  // Load saved insights
  const loadSavedInsights = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !insightsUsageInfo) return;

      const { data, error } = await supabase
        .from('analytics_insights')
        .select('insights, generated_at')
        .eq('user_id', user.id)
        .eq('week_start_date', insightsUsageInfo.weekStart)
        .order('generated_at', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error loading saved insights:', error);
        return;
      }

      if (data && data.length > 0) {
        setAiInsights(data[0].insights);
      }
    } catch (error) {
      console.error('Error loading saved insights:', error);
    }
  };

  // Load insights usage on component mount
  useEffect(() => {
    fetchInsightsUsage();
  }, []);

  // Load saved insights when usage info is available
  useEffect(() => {
    if (insightsUsageInfo) {
      loadSavedInsights();
    }
  }, [insightsUsageInfo]);

  // Auto-save insights when they change
  useEffect(() => {
    if (aiInsights && insightsUsageInfo && aiInsights !== 'Failed to generate insights. Please try again.') {
      const timeoutId = setTimeout(() => {
        saveInsightsToDatabase(aiInsights);
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [aiInsights, insightsUsageInfo]);

  // Reset functions
  const resetAllFilters = () => {
    setScope("both");
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setExpMin('');
    setExpMax('');
    setActMin('');
    setActMax('');
  };

  const filtersCardClass = isLightTheme
    ? "bg-white border border-slate-200"
    : "bg-slate-800/60 border border-slate-600";
  const cardHeadingClass = isLightTheme ? "text-slate-900" : "text-white";
  const labelClass = isLightTheme ? "text-sm font-medium text-slate-600" : "text-sm font-medium text-slate-300";
  const inputBaseClass = isLightTheme
    ? "border-slate-300 bg-white text-slate-900 placeholder:text-slate-400"
    : "border-slate-600 bg-slate-700 text-white placeholder:text-slate-400";

  const baseCardClass = isLightTheme
    ? "bg-white border border-slate-200 shadow-sm text-slate-900"
    : "bg-slate-800/60 border border-slate-600 text-white";
  const subCardClass = isLightTheme
    ? "bg-slate-50 border border-slate-200 text-slate-700"
    : "bg-slate-900/50 border border-slate-700 text-slate-300";
  const mutedTextClass = isLightTheme ? "text-slate-500" : "text-slate-400";
  
  // Chart container classes
  const chartContainerClass = isLightTheme
    ? "bg-white border border-slate-200 shadow-sm"
    : "bg-slate-800/60 border border-slate-600";
  const chartSubContainerClass = isLightTheme
    ? "bg-slate-50 border border-slate-200"
    : "bg-slate-700/50 border border-slate-600";
  const chartTitleClass = isLightTheme
    ? "text-lg font-semibold text-slate-900 mb-3"
    : "text-lg font-semibold text-white mb-3";
  const chartSubTitleClass = isLightTheme
    ? "text-sm font-semibold text-slate-700 mb-3"
    : "text-sm font-semibold text-slate-300 mb-3";
  
  // Predictive analytics classes
  const predictiveContainerClass = isLightTheme
    ? "bg-white border border-blue-200 shadow-sm"
    : "bg-slate-800/60 border border-blue-500/20";
  const predictiveSubTextClass = isLightTheme
    ? "text-xs text-slate-500"
    : "text-xs text-slate-400";
  
  // Warning box classes
  const warningBoxClass = isLightTheme
    ? "bg-amber-50 border border-amber-200"
    : "bg-amber-900/30 border border-amber-500/50";
  const warningIconClass = isLightTheme ? "text-amber-600" : "text-amber-400";
  const warningTitleClass = isLightTheme
    ? "text-sm font-semibold text-amber-800 mb-1"
    : "text-sm font-semibold text-amber-300 mb-1";
  const warningTextClass = isLightTheme
    ? "text-xs text-amber-700/90"
    : "text-xs text-amber-200/80";
  
  // Summary section classes
  const summaryBorderClass = isLightTheme
    ? "border-t border-slate-300"
    : "border-t border-slate-600";
  const summaryTitleClass = isLightTheme
    ? "text-sm font-semibold text-slate-700 mb-3"
    : "text-sm font-semibold text-slate-300 mb-3";
  const summaryLabelClass = isLightTheme
    ? "text-xs text-slate-500"
    : "text-xs text-slate-400";
  const summaryValueClass = isLightTheme
    ? "text-lg font-semibold text-slate-900"
    : "text-lg font-semibold text-white";
  const summaryValueXlClass = isLightTheme
    ? "text-xl font-semibold text-slate-900"
    : "text-xl font-semibold text-white";
  
  // AI Insights classes
  const aiInsightsContainerClass = isLightTheme
    ? "bg-white border border-purple-200 shadow-sm"
    : "bg-slate-800/60 border border-purple-500/20";
  const aiInsightsUsageClass = isLightTheme
    ? "bg-slate-50 border border-slate-200"
    : "bg-slate-700/50 border border-slate-600";
  const aiInsightsUsageTextClass = isLightTheme
    ? "text-xs text-slate-600"
    : "text-xs text-slate-300";
  const aiInsightsTextareaClass = isLightTheme
    ? "w-full min-h-[120px] p-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 leading-relaxed resize-vertical focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
    : "w-full min-h-[120px] p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 leading-relaxed resize-vertical focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent";
  const aiInsightsHelperTextClass = isLightTheme
    ? "text-xs text-slate-500"
    : "text-xs text-slate-400";
  
  // Loading/empty state classes
  const loadingTextClass = isLightTheme
    ? "text-slate-600"
    : "text-slate-400";

  return (
    <div className={`w-full max-w-6xl mx-auto py-8 pr-3 ${isLightTheme ? "analytics-light" : ""}`}>
      {/* Header */}
      <div className="mb-6">
        <h1 className={`text-3xl font-bold mb-4 ${cardHeadingClass}`}>Analytics</h1>
        
        {/* Filters Section */}
        <div className={`${filtersCardClass} rounded-lg p-4`}>
          <div className="flex items-center justify-between mb-4">
            <h2 className={`text-lg font-semibold ${cardHeadingClass}`}>Filters</h2>
            <div className="flex items-center gap-2">
              {loading && showStuckRefresh && (
                <Button
                  onClick={() => { setShowStuckRefresh(false); setRefreshNonce((n) => n + 1); }}
                  variant="outline"
                  size="sm"
                  className={
                    isLightTheme
                      ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                      : "border-amber-400/30 text-amber-300 hover:bg-amber-400/20 hover:text-amber-200"
                  }
                >
                  Retry Load
                </Button>
              )}
              <Button 
                onClick={resetAllFilters}
                variant="outline"
                size="sm"
                className={
                  isLightTheme
                    ? "border-red-200 text-red-600 hover:bg-red-50"
                    : "border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
                }
              >
                Reset All
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Scope Filter */}
            <div className="space-y-2">
              <label className={labelClass}>Scope</label>
                <Select value={scope} onValueChange={(v: any) => setScope(v)}>
                  <SelectTrigger className="w-full max-w-[180px]">
                    <SelectValue placeholder="Scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="owned">My Events</SelectItem>
                    <SelectItem value="joined">Joined Events</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            {/* Type Filter */}
            <div className="space-y-2">
              <label className={labelClass}>Event Type</label>
                <Select value={typeFilter} onValueChange={(v:any)=>setTypeFilter(v)}>
                  <SelectTrigger className="w-full max-w-[180px]">
                    <SelectValue placeholder="Event Type"/>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="Technology">Technology</SelectItem>
                    <SelectItem value="Music">Music</SelectItem>
                    <SelectItem value="Food & Drink">Food & Drink</SelectItem>
                    <SelectItem value="Arts & Culture">Arts & Culture</SelectItem>
                    <SelectItem value="Business">Business</SelectItem>
                    <SelectItem value="Gaming">Gaming</SelectItem>
                    <SelectItem value="Health">Health</SelectItem>
                    <SelectItem value="Film">Film</SelectItem>
                    <SelectItem value="Sports">Sports</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2 md:col-span-2">
              <label className={labelClass}>Date Range</label>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-[380px]">
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e=>setDateFrom(e.target.value)} 
                    className={`h-10 rounded-md border px-3 text-sm flex-1 min-w-0 ${inputBaseClass}`}
                    placeholder="From"
                  />
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e=>setDateTo(e.target.value)} 
                    className={`h-10 rounded-md border px-3 text-sm flex-1 min-w-0 ${inputBaseClass}`}
                    placeholder="To"
                  />
              </div>
            </div>

            {/* Expected Attendees */}
            <div className="space-y-2">
              <label className={labelClass}>Expected Attendees</label>
                <div className="flex gap-1 max-w-[200px] mx-auto">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={expMin} 
                    onChange={e=>setExpMin(e.target.value)} 
                    className={`h-10 w-20 rounded-md border px-2 text-sm ${inputBaseClass}`}
                  />
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={expMax} 
                    onChange={e=>setExpMax(e.target.value)} 
                    className={`h-10 w-20 rounded-md border px-2 text-sm ${inputBaseClass}`}
                  />
              </div>
            </div>

            {/* Actual Attendees */}
            <div className="space-y-2">
              <label className={labelClass}>Actual Attendees</label>
                <div className="flex gap-1 max-w-[200px] mx-auto">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={actMin} 
                    onChange={e=>setActMin(e.target.value)} 
                    className={`h-10 w-20 rounded-md border px-2 text-sm ${inputBaseClass}`}
                  />
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={actMax} 
                    onChange={e=>setActMax(e.target.value)} 
                    className={`h-10 w-20 rounded-md border px-2 text-sm ${inputBaseClass}`}
                  />
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="w-4 h-4 animate-spin"/> Loading…</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : aggregates ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={`${baseCardClass} rounded-lg p-4 text-center border border-green-500/20`}>
              <div className={`${mutedTextClass} text-sm`}>Total Events</div>
              <div className={`text-lg sm:text-xl md:text-2xl font-bold break-words ${cardHeadingClass}`}>{aggregates.totalEvents}</div>
            </div>
            <div className={`${baseCardClass} rounded-lg p-4 text-center border border-amber-500/20`}>
              <div className={`${mutedTextClass} text-sm`}>Total Items</div>
              <div className={`text-lg sm:text-xl md:text-2xl font-bold break-words ${cardHeadingClass}`}>{aggregates.totalItems}</div>
            </div>
            <div className={`${baseCardClass} rounded-lg p-4 text-center border border-blue-500/20`}>
              <div className={`${mutedTextClass} text-sm`}>Total Item Cost</div>
              <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold break-words ${cardHeadingClass}`}>PHP {aggregates.totalItemCost.toFixed(2)}</div>
            </div>
            <div className={`${baseCardClass} rounded-lg p-4 text-center border border-purple-500/20`}>
              <div className={`${mutedTextClass} text-sm`}>Estimated Revenue</div>
              <div className={`text-sm sm:text-lg md:text-xl lg:text-2xl font-bold break-words ${cardHeadingClass}`}>PHP {aggregates.estRevenue.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`${baseCardClass} rounded-lg p-4`}>
              <div className={`${mutedTextClass} text-sm`}>Avg Items / Event</div>
              <div className={`text-xl font-semibold ${cardHeadingClass}`}>{aggregates.avgItemsPerEvent.toFixed(1)}</div>
            </div>
            <div className={`${baseCardClass} rounded-lg p-4`}>
              <div className={`${mutedTextClass} text-sm`}>Avg Cost / Event</div>
              <div className={`text-xl font-semibold ${cardHeadingClass}`}>PHP {aggregates.avgCostPerEvent.toFixed(2)}</div>
            </div>
            <div className={`${baseCardClass} rounded-lg p-4`}>
              <div className={`${mutedTextClass} text-sm`}>Events With Items</div>
              <div className={`text-xl font-semibold ${cardHeadingClass}`}>{new Set(items.map(i => i.event_id)).size}</div>
            </div>
          </div>

          {/* Attendance Overview Pie */}
          {mounted && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className={`${baseCardClass} rounded-lg p-4 md:col-span-1`}>
                <h3 className={`text-lg font-semibold mb-3 ${cardHeadingClass}`}>Attendance Overview</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie 
                        data={attendancePie} 
                        dataKey="value" 
                        nameKey="name" 
                        innerRadius={50} 
                        outerRadius={80}
                        isAnimationActive={false}
                      >
                        {attendancePie.map((entry, idx) => {
                          const fillColor = entry.fill || (idx === 0 ? '#6366f1' : '#22c55e');
                          return (
                            <Cell 
                              key={`cell-attendance-${idx}`} 
                              fill={fillColor}
                              stroke={fillColor}
                              strokeWidth={2}
                            />
                          );
                        })}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                      <Legend 
                        wrapperStyle={{ color: 'currentColor' }} 
                        iconType="circle"
                        formatter={(value: string, entry: any) => {
                          const dataEntry = attendancePie.find((d: any) => d.name === value);
                          const legendColor = dataEntry?.fill || entry.color || '#999';
                          return <span style={{ color: legendColor }}>{value}</span>;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className={`mt-3 text-sm ${mutedTextClass}`}>
                  Avg Rating: <span className="font-semibold">{aggregates.avgRating.toFixed(1)}/5</span>
                </div>
              </div>

            {/* Cost over Time */}
            <div className={`${chartContainerClass} rounded-lg p-4 md:col-span-2`}>
              <h3 className={chartTitleClass}>Total Item Cost Over Time</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={lineData} margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: '#cbd5e1' }} hide={lineData.length > 6} />
                    <YAxis tick={{ fill: '#cbd5e1' }} />
                    <Tooltip contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                    <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
          )}

          {/* Cost vs Expected Attendees */}
          <div className={`${chartContainerClass} rounded-lg p-4`}>
            <h3 className={chartTitleClass}>Cost vs Expected Attendees</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="x" name="Total Cost" tick={{ fill: '#cbd5e1' }} />
                  <YAxis dataKey="y" name="Expected" tick={{ fill: '#cbd5e1' }} />
                  <ZAxis range={[60, 120]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                  <Scatter data={scatterData} fill="#06b6d4" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top events by cost */}
          <div className={`${chartContainerClass} rounded-lg p-4`}>
            <h3 className={chartTitleClass}>Top Events by Total Item Cost</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={costChartData.map((item: any, idx: number) => ({ ...item, _index: idx }))} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: '#cbd5e1' }} hide={costChartData.length > 6} />
                  <YAxis tick={{ fill: '#cbd5e1' }} />
                  <Tooltip cursor={{ fill: 'rgba(148,163,184,0.08)' }} contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} labelStyle={{ color: '#cbd5e1' }} itemStyle={{ color: '#22c55e' }} />
                  <Bar dataKey="cost" shape={(props: any) => {
                    const { x, y, width, height, payload } = props;
                    const idx = payload?._index ?? 0;
                    return <rect x={x} y={y} width={width} height={height} fill={COLORS[idx % COLORS.length]} />;
                  }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Predictive Analytics Charts */}
          {loadingPredictions && (
            <div className={`${predictiveContainerClass} rounded-lg p-4`}>
              <div className={`flex items-center gap-2 ${loadingTextClass}`}>
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading predictive analytics...
              </div>
            </div>
          )}
          {!loadingPredictions && (!predictionsData || !predictionsData.predictions || predictionsData.predictions.length === 0) && events.length > 0 && (
            <div className={`${predictiveContainerClass} rounded-lg p-4`}>
              <div className="text-center py-8">
                <p className={`${loadingTextClass} mb-2`}>Predictive analytics will appear here</p>
                <p className={predictiveSubTextClass}>Loading predictions based on your event data...</p>
              </div>
            </div>
          )}
          {predictionsData && predictionsData.predictions && (
            <div className={`${predictiveContainerClass} rounded-lg p-4`}>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                <div>
                  <h3 className={`text-lg font-semibold ${isLightTheme ? "text-blue-600" : "text-blue-400"} mb-1`}>Predictive Analytics (Next 6 Months)</h3>
                  <p className={predictiveSubTextClass}>Monthly forecasts based on your historical event data</p>
                </div>
                {loadingPredictions && (
                  <div className={`flex items-center gap-2 text-sm ${loadingTextClass}`}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating predictions...
                  </div>
                )}
              </div>

              {/* Data Quality Warning */}
              {predictionsData.data_quality && predictionsData.data_quality.has_low_accuracy && (
                <div className={`mb-4 p-3 ${warningBoxClass} rounded-lg`}>
                  <div className="flex items-start gap-2">
                    <div className={`${warningIconClass} mt-0.5`}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className={warningTitleClass}>Low Prediction Accuracy Warning</div>
                      <div className={warningTextClass}>
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

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Predicted Cost */}
                <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                  <h4 className={chartSubTitleClass}>Predicted Event Costs (Monthly)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        ...(() => {
                          // Aggregate historical data by month
                          const monthlyData = new Map<string, { month_year: string; cost: number }>();
                          lineData.forEach((d: any) => {
                            if (!d.date) return;
                            const date = new Date(d.date);
                            const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                            const existing = monthlyData.get(monthYear) || { month_year: monthYear, cost: 0 };
                            existing.cost += d.cost;
                            monthlyData.set(monthYear, existing);
                          });
                          return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                        })(),
                        ...(predictionsData.predictions || []).map((p: any) => ({
                          month_year: p.month_year || p.date,
                          cost: p.predicted_cost || 0,
                          type: "Predicted"
                        }))
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month_year" tick={{ fill: '#cbd5e1', fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#cbd5e1' }} />
                        <Tooltip 
                          formatter={(value: any) => `PHP ${Number(value).toFixed(2)}`}
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#f59e0b' }} 
                        />
                        <Legend />
                        <Area type="monotone" dataKey="cost" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="Cost" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Predicted Revenue */}
                <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                  <h4 className={chartSubTitleClass}>Predicted Revenue (Monthly)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        ...(() => {
                          // Aggregate historical revenue by month
                          const monthlyData = new Map<string, { month_year: string; revenue: number }>();
                          lineData.forEach((d: any) => {
                            if (!d.date) return;
                            const ev = visible.events.find((e: any) => e.title === d.name);
                            if (!ev) return;
                            const eventItems = items.filter((i: any) => i.event_id === ev.id);
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
                            
                            const date = new Date(d.date);
                            const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                            const existing = monthlyData.get(monthYear) || { month_year: monthYear, revenue: 0 };
                            existing.revenue += finalRevenue;
                            monthlyData.set(monthYear, existing);
                          });
                          return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                        })(),
                        ...(predictionsData.predictions || []).map((p: any) => ({
                          month_year: p.month_year || p.date,
                          revenue: p.predicted_revenue || 0,
                          type: "Predicted"
                        }))
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month_year" tick={{ fill: '#cbd5e1', fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#cbd5e1' }} />
                        <Tooltip 
                          formatter={(value: any) => `PHP ${Number(value).toFixed(2)}`}
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#22c55e' }} 
                        />
                        <Legend />
                        <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} name="Revenue" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Predicted Events */}
                <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                  <h4 className={chartSubTitleClass}>Predicted Event Creation (Monthly)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        ...(() => {
                          // Aggregate historical events by month
                          const monthlyData = new Map<string, { month_year: string; events: number }>();
                          lineData.forEach((d: any) => {
                            if (!d.date) return;
                            const date = new Date(d.date);
                            const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                            const existing = monthlyData.get(monthYear) || { month_year: monthYear, events: 0 };
                            existing.events += 1;
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month_year" tick={{ fill: '#cbd5e1', fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#cbd5e1' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#3b82f6' }} 
                        />
                        <Legend />
                        <Area type="monotone" dataKey="events" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="Events" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Predicted Attendance */}
                <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                  <h4 className={chartSubTitleClass}>Predicted Expected Attendance (Monthly)</h4>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={[
                        ...(() => {
                          // Aggregate historical attendance by month
                          const monthlyData = new Map<string, { month_year: string; attendees: number }>();
                          lineData.forEach((d: any) => {
                            if (!d.date) return;
                            const ev = visible.events.find((e: any) => e.title === d.name);
                            if (!ev) return;
                            const att = attStats.find((a: any) => a.event_id === ev.id);
                            const attendees = att?.expected_attendees || 0;
                            
                            const date = new Date(d.date);
                            const monthYear = `${date.toLocaleString('default', { month: 'short' })} ${date.getFullYear()}`;
                            const existing = monthlyData.get(monthYear) || { month_year: monthYear, attendees: 0 };
                            existing.attendees += attendees;
                            monthlyData.set(monthYear, existing);
                          });
                          return Array.from(monthlyData.values()).map(d => ({ ...d, type: "Historical" }));
                        })(),
                        ...(predictionsData.predictions || []).map((p: any) => ({
                          month_year: p.month_year || p.date,
                          attendees: p.predicted_expected_attendees || 0,
                          type: "Predicted"
                        }))
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="month_year" tick={{ fill: '#cbd5e1', fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                        <YAxis tick={{ fill: '#cbd5e1' }} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid #334155', color: '#e2e8f0' }} 
                          labelStyle={{ color: '#cbd5e1' }} 
                          itemStyle={{ color: '#ec4899' }} 
                        />
                        <Legend />
                        <Area type="monotone" dataKey="attendees" stroke="#ec4899" fill="#ec4899" fillOpacity={0.3} name="Expected Attendees" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Prediction Summary */}
              {predictionsData.trends && (
                <div className={`mt-4 pt-4 ${summaryBorderClass}`}>
                  <h4 className={summaryTitleClass}>Prediction Summary</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className={summaryLabelClass}>Avg Daily Cost</div>
                      <div className={summaryValueClass}>PHP {predictionsData.trends.avg_daily_cost?.toFixed(2) || "0.00"}</div>
                    </div>
                    <div>
                      <div className={summaryLabelClass}>Avg Daily Revenue</div>
                      <div className={summaryValueClass}>PHP {predictionsData.trends.avg_daily_revenue?.toFixed(2) || "0.00"}</div>
                    </div>
                    <div>
                      <div className={summaryLabelClass}>Cost Growth</div>
                      <div className={`text-lg font-semibold ${(predictionsData.trends.cost_growth_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {predictionsData.trends.cost_growth_rate?.toFixed(1) || "0.0"}%
                      </div>
                    </div>
                    <div>
                      <div className={summaryLabelClass}>Revenue Growth</div>
                      <div className={`text-lg font-semibold ${(predictionsData.trends.revenue_growth_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {predictionsData.trends.revenue_growth_rate?.toFixed(1) || "0.0"}%
                      </div>
                    </div>
                  </div>
                  
                  {/* Next Month Predictions */}
                  {predictionsData.predictions_summary && (
                    <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                      <h5 className={`text-xs font-semibold ${isLightTheme ? "text-blue-600" : "text-blue-400"} mb-3`}>Next Month Forecast</h5>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className={summaryLabelClass}>Predicted Event Count</div>
                          <div className={summaryValueXlClass}>{predictionsData.predictions_summary.next_month_event_count || 0}</div>
                          <div className={`${predictiveSubTextClass} mt-1`}>events</div>
                        </div>
                        <div>
                          <div className={summaryLabelClass}>Estimated Revenue</div>
                          <div className="text-xl font-semibold text-green-400">PHP {predictionsData.predictions_summary.next_month_estimated_revenue?.toFixed(2) || "0.00"}</div>
                        </div>
                        <div>
                          <div className={summaryLabelClass}>Estimated Cost</div>
                          <div className="text-xl font-semibold text-amber-400">PHP {predictionsData.predictions_summary.next_month_estimated_cost?.toFixed(2) || "0.00"}</div>
                        </div>
                      </div>
                      {predictionsData.predictions_summary.next_6_months_total_events !== undefined && (
                        <div className={`pt-3 ${summaryBorderClass}`}>
                          <h6 className={`text-xs font-semibold ${summaryLabelClass} mb-2`}>Next 6 Months Total</h6>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            <div>
                              <div className={predictiveSubTextClass}>Total Events</div>
                              <div className={`${summaryValueClass} font-semibold`}>{predictionsData.predictions_summary.next_6_months_total_events || 0}</div>
                            </div>
                            <div>
                              <div className={predictiveSubTextClass}>Total Revenue</div>
                              <div className="text-green-400 font-semibold">PHP {predictionsData.predictions_summary.next_6_months_total_revenue?.toFixed(2) || "0.00"}</div>
                            </div>
                            <div>
                              <div className={predictiveSubTextClass}>Total Cost</div>
                              <div className="text-amber-400 font-semibold">PHP {predictionsData.predictions_summary.next_6_months_total_cost?.toFixed(2) || "0.00"}</div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Popular Events & Categories */}
                  {predictionsData.popular_insights && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {predictionsData.popular_insights.top_categories && predictionsData.popular_insights.top_categories.length > 0 && (
                        <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                          <h5 className={`text-xs font-semibold ${isLightTheme ? "text-purple-600" : "text-purple-400"} mb-2`}>Top Event Categories</h5>
                          <div className="space-y-1">
                            {predictionsData.popular_insights.top_categories.slice(0, 3).map((cat: any, idx: number) => (
                              <div key={idx} className="flex justify-between text-xs">
                                <span className={isLightTheme ? "text-slate-700" : "text-slate-300"}>{cat.category}</span>
                                <span className={mutedTextClass}>{cat.count} events</span>
                              </div>
                            ))}
                          </div>
                          {predictionsData.popular_insights.predicted_popular_category && (
                            <div className={`mt-2 pt-2 ${summaryBorderClass}`}>
                              <div className={summaryLabelClass}>Predicted Popular:</div>
                              <div className={`text-sm font-semibold ${isLightTheme ? "text-purple-700" : "text-purple-300"}`}>{predictionsData.popular_insights.predicted_popular_category}</div>
                            </div>
                          )}
                        </div>
                      )}
                      {predictionsData.popular_insights.popular_events && predictionsData.popular_insights.popular_events.length > 0 && (
                        <div className={`${chartSubContainerClass} rounded-lg p-4`}>
                          <h5 className={`text-xs font-semibold ${isLightTheme ? "text-cyan-600" : "text-cyan-400"} mb-2`}>Most Popular Events</h5>
                          <div className="space-y-2">
                            {predictionsData.popular_insights.popular_events.slice(0, 3).map((ev: any, idx: number) => (
                              <div key={idx} className="text-xs">
                                <div className={`${isLightTheme ? "text-slate-700" : "text-slate-300"} font-medium truncate`}>{ev.name}</div>
                                <div className={mutedTextClass}>PHP {ev.revenue?.toFixed(2) || "0.00"} revenue • {ev.attendees || 0} attendees</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Analytics Insights */}
          <div className={`${aiInsightsContainerClass} rounded-lg p-4`}>
            <h3 className={`text-lg font-semibold ${isLightTheme ? "text-purple-600" : "text-purple-400"} mb-2`}>AI Analytics Insights</h3>
            
            {/* Usage Info */}
            {insightsUsageInfo && (
              <div className={`mb-4 p-3 ${aiInsightsUsageClass} rounded-lg`}>
                <p className={aiInsightsUsageTextClass}>
                  Insights generated this week: {insightsUsageInfo.insightsGenerated}/{insightsUsageInfo.maxInsights}
                  {!insightsUsageInfo.canGenerateMore && (
                    <span className="text-red-400 ml-2">(Limit reached)</span>
                  )}
                </p>
              </div>
            )}
            
            {aiInsights ? (
              <div className="space-y-3">
                {/* Quick Summary */}
                {predictionsData && predictionsData.trends && (
                  <div className={`p-3 ${isLightTheme ? "bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200" : "bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30"} rounded-lg`}>
                    <h4 className={`text-sm font-semibold ${isLightTheme ? "text-purple-700" : "text-purple-300"} mb-2`}>Quick Summary</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <div className={summaryLabelClass}>Avg Daily Cost</div>
                        <div className={summaryValueClass}>PHP {predictionsData.trends.avg_daily_cost?.toFixed(2) || "0.00"}</div>
                      </div>
                      <div>
                        <div className={summaryLabelClass}>Avg Daily Revenue</div>
                        <div className={summaryValueClass}>PHP {predictionsData.trends.avg_daily_revenue?.toFixed(2) || "0.00"}</div>
                      </div>
                      <div>
                        <div className={summaryLabelClass}>Cost Growth</div>
                        <div className={`font-semibold ${(predictionsData.trends.cost_growth_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {predictionsData.trends.cost_growth_rate?.toFixed(1) || "0.0"}%
                        </div>
                      </div>
                      <div>
                        <div className={summaryLabelClass}>Revenue Growth</div>
                        <div className={`font-semibold ${(predictionsData.trends.revenue_growth_rate || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {predictionsData.trends.revenue_growth_rate?.toFixed(1) || "0.0"}%
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <textarea
                  value={aiInsights}
                  onChange={(e) => setAiInsights(e.target.value)}
                  className={aiInsightsTextareaClass}
                  placeholder="Generated insights will appear here..."
                />
                <div className={`flex items-center justify-between ${aiInsightsHelperTextClass}`}>
                  <span>You can edit the insights above</span>
                  <div className="flex items-center gap-2">
                    {isSaving && (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Saving...
                      </span>
                    )}
                    {lastSaved && !isSaving && (
                      <span>Saved {lastSaved.toLocaleTimeString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <p className={aiInsightsHelperTextClass}>Generate AI-powered analytics insights that include descriptive analytics (current performance and historical trends) and predictive insights (forecasts for the next 30 days) in a concise paragraph format.</p>
            )}
            <div className="mt-3">
              <Button 
                onClick={generateInsights} 
                disabled={isGenerating || (insightsUsageInfo ? !insightsUsageInfo.canGenerateMore : false)} 
                className={`text-white ${
                  !insightsUsageInfo || insightsUsageInfo.canGenerateMore
                    ? "bg-purple-600 hover:bg-purple-700" 
                    : "bg-slate-600 cursor-not-allowed opacity-50"
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin"/>
                    Generating...
                  </>
                ) : (
                  'Generate Analytics Insights'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className={loadingTextClass}>No events to analyze.</div>
      )}
    </div>
  );
}

