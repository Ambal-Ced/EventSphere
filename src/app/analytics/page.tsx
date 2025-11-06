"use client";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
// Lazy-load Recharts bits client-side only
const loadingBox = (h:number=300) => <div style={{height:h}} className="w-full animate-pulse rounded bg-slate-700/40"/>;
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
import { DefaultSubscriptionManager } from "@/lib/default-subscription-manager";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// Note: Metadata must be exported from a server component. This page is client-only.

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

export default function AnalyticsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const [scope, setScope] = useState<"owned" | "joined" | "both">("owned");
  const [loading, setLoading] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [showStuckRefresh, setShowStuckRefresh] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [items, setItems] = useState<EventItem[]>([]);
  const [attStats, setAttStats] = useState<{ event_id: string; expected_attendees: number; event_attendees: number }[]>([]);
  const [feedback, setFeedback] = useState<{ event_id: string; rating: number; sentiment?: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [expMin, setExpMin] = useState<string>('');
  const [expMax, setExpMax] = useState<string>('');
  const [actMin, setActMin] = useState<string>('');
  const [actMax, setActMax] = useState<string>('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error("You must be signed in");

        // Owned
        let ownedEvents: EventRow[] = [];
        if (scope !== "joined") {
          const { data } = await supabase
            .from("events")
            .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
            .eq("user_id", user.id);
          ownedEvents = (data || []) as any;
        }

        // Joined: first try direct collaborators → then fetch events; fallback to RPC if needed
        let joinedEvents: EventRow[] = [];
        if (scope !== "owned") {
          const { data: collabRows, error: collabErr } = await supabase
            .from("event_collaborators")
            .select("event_id")
            .eq("user_id", user.id);
          let joinedIds: string[] = (collabRows || []).map((r: any) => r.event_id);
          if ((!collabRows || collabRows.length === 0) && collabErr == null) {
            // Try RPC fallback if table restricted by RLS
            const { data: rpcData } = await supabase.rpc("get_user_collaborations", { p_user_id: user.id });
            joinedIds = (rpcData || []).map((r: any) => r.event_id || r.id).filter(Boolean);
          }
          if (joinedIds.length > 0) {
            const { data: joined } = await supabase
              .from("events")
              .select("id,title,date,user_id,category,markup_type,markup_value,discount_type,discount_value")
              .in("id", joinedIds);
            joinedEvents = (joined || []) as any;
          }
        }

        const all = scope === "owned"
          ? ownedEvents
          : scope === "joined"
          ? joinedEvents
          : Array.from(new Map([...ownedEvents, ...joinedEvents].map((e: any) => [e.id, e])).values());

        setEvents(all);

        if (all.length > 0) {
          const { data: itemRows } = await supabase
            .from("event_items")
            .select("event_id,cost,item_quantity")
            .in("event_id", all.map((e) => e.id));
          setItems(itemRows || []);

          // Attendance stats
          const { data: attRows } = await supabase
            .from("attendees")
            .select("event_id,expected_attendees,event_attendees")
            .in("event_id", all.map((e) => e.id));
          setAttStats((attRows || []) as any);

          // Feedback (ratings)
          const { data: fbRows } = await supabase
            .from("feedback_responses")
            .select("event_id,rating,sentiment")
            .in("event_id", all.map((e) => e.id));
          setFeedback((fbRows || []) as any);
        } else {
          setItems([]);
          setAttStats([]);
          setFeedback([]);
        }
      } catch (e: any) {
        setError(e.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, [scope, refreshNonce]);

  // Show a retry button if still loading after 120s (soft refresh only)
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

  // Fetch insights usage info
  const fetchInsightsUsage = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's subscription to determine AI insights limits
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

      // Use the dedicated analytics insights usage function
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
      console.log('Incrementing insights usage...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !insightsUsageInfo) {
        console.log('No user or usage info, skipping increment');
        return;
      }

      console.log('Updating usage for user:', user.id, 'week:', insightsUsageInfo.weekStart);
      const { error } = await supabase
        .from('analytics_insights_usage')
        .update({ insights_generated: insightsUsageInfo.insightsGenerated + 1 })
        .eq('user_id', user.id)
        .eq('week_start_date', insightsUsageInfo.weekStart);

      if (error) {
        console.error('Database update error:', error);
        throw error;
      }

      console.log('Usage updated successfully');
      // Update local state
      setInsightsUsageInfo(prev => prev ? {
        ...prev,
        insightsGenerated: prev.insightsGenerated + 1,
        canGenerateMore: prev.insightsGenerated + 1 < prev.maxInsights
      } : null);
    } catch (error) {
      console.error('Error incrementing insights usage:', error);
      throw error; // Re-throw to be caught by generateInsights
    }
  };

  // Save insights to database
  const saveInsightsToDatabase = async (insights: string) => {
    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No user found, skipping save');
        return false;
      }

      if (!insightsUsageInfo?.weekStart) {
        console.log('No week start date, skipping save');
        return false;
      }

      console.log('Saving insights to database...');
      // Save to a special analytics_insights table or use a generic insights storage
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
        // Fallback: try to create table if it doesn't exist
        console.log('Analytics insights table may not exist, insights will not persist');
        return false;
      }
      
      console.log('Insights saved successfully');
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
      console.log('Starting insights generation...');
      
      // Increment usage counter
      await incrementInsightsUsage();
      console.log('Usage incremented successfully');

      const top = costChartData[0];
      const text = `Overview: ${aggregates.totalEvents} events, ${aggregates.totalItems} items; total cost PHP ${aggregates.totalItemCost.toFixed(2)}, est. revenue PHP ${aggregates.estRevenue.toFixed(2)}. Pricing: average cost/event PHP ${aggregates.avgCostPerEvent.toFixed(2)}; top cost event "${top ? top.name : 'N/A'}" at PHP ${(top?.cost || 0).toFixed(2)}. Recommendations: audit high-cost events, align markup/discount to target margins, and standardize item templates to reduce variance.`;
      
      console.log('Generated insights text:', text);
      setAiInsights(text);
      
      // Automatically save to database
      await saveInsightsToDatabase(text);
      console.log('Insights automatically saved to database');
    } catch (error) {
      console.error('Error generating insights:', error);
      // Set a fallback message if generation fails
      setAiInsights('Failed to generate insights. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

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

  // Auto-save insights when they change (for manual edits)
  useEffect(() => {
    if (aiInsights && insightsUsageInfo && aiInsights !== 'Failed to generate insights. Please try again.') {
      // Debounce auto-save to avoid too many database calls
      const timeoutId = setTimeout(() => {
        saveInsightsToDatabase(aiInsights);
      }, 2000); // Save 2 seconds after user stops typing/editing

      return () => clearTimeout(timeoutId);
    }
  }, [aiInsights, insightsUsageInfo]);

  // Reset functions
  const resetAllFilters = () => {
    setScope("owned");
    setTypeFilter('all');
    setDateFrom('');
    setDateTo('');
    setExpMin('');
    setExpMax('');
    setActMin('');
    setActMax('');
  };

  const resetSpecificFilter = (filterType: string) => {
    switch (filterType) {
      case 'scope':
        setScope("owned");
        break;
      case 'type':
        setTypeFilter('all');
        break;
      case 'date':
        setDateFrom('');
        setDateTo('');
        break;
      case 'expected':
        setExpMin('');
        setExpMax('');
        break;
      case 'actual':
        setActMin('');
        setActMax('');
        break;
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-8 pr-3">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-4">Analytics</h1>
        
        {/* Filters Section */}
        <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Filters</h2>
            <div className="flex items-center gap-2">
              {loading && showStuckRefresh && (
                <Button
                  onClick={() => { setShowStuckRefresh(false); setRefreshNonce((n) => n + 1); }}
                  variant="outline"
                  size="sm"
                  className="border-amber-400/30 text-amber-300 hover:bg-amber-400/20 hover:text-amber-200"
                >
                  Retry Load
                </Button>
              )}
              <Button 
                onClick={resetAllFilters}
                variant="outline"
                size="sm"
                className="border-red-500/30 text-red-400 hover:bg-red-500/20 hover:text-red-300"
              >
                Reset All
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Scope Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Scope</label>
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
              <label className="text-sm font-medium text-slate-300">Event Type</label>
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
              <label className="text-sm font-medium text-slate-300">Date Range</label>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:max-w-[380px]">
                  <input 
                    type="date" 
                    value={dateFrom} 
                    onChange={e=>setDateFrom(e.target.value)} 
                    className="h-10 rounded-md border border-slate-600 bg-slate-700 text-white px-3 text-sm flex-1 min-w-0"
                    placeholder="From"
                  />
                  <input 
                    type="date" 
                    value={dateTo} 
                    onChange={e=>setDateTo(e.target.value)} 
                    className="h-10 rounded-md border border-slate-600 bg-slate-700 text-white px-3 text-sm flex-1 min-w-0"
                    placeholder="To"
                  />
              </div>
            </div>

            {/* Expected Attendees */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Expected Attendees</label>
                <div className="flex gap-1 max-w-[200px] mx-auto">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={expMin} 
                    onChange={e=>setExpMin(e.target.value)} 
                    className="h-10 w-20 rounded-md border border-slate-600 bg-slate-700 text-white px-2 text-sm"
                  />
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={expMax} 
                    onChange={e=>setExpMax(e.target.value)} 
                    className="h-10 w-20 rounded-md border border-slate-600 bg-slate-700 text-white px-2 text-sm"
                  />
              </div>
            </div>

            {/* Actual Attendees */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Actual Attendees</label>
                <div className="flex gap-1 max-w-[200px] mx-auto">
                  <input 
                    type="number" 
                    placeholder="Min" 
                    value={actMin} 
                    onChange={e=>setActMin(e.target.value)} 
                    className="h-10 w-20 rounded-md border border-slate-600 bg-slate-700 text-white px-2 text-sm"
                  />
                  <input 
                    type="number" 
                    placeholder="Max" 
                    value={actMax} 
                    onChange={e=>setActMax(e.target.value)} 
                    className="h-10 w-20 rounded-md border border-slate-600 bg-slate-700 text-white px-2 text-sm"
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
            <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-green-500/20">
              <div className="text-slate-400 text-sm">Total Events</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-white break-words">{aggregates.totalEvents}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-amber-500/20">
              <div className="text-slate-400 text-sm">Total Items</div>
              <div className="text-lg sm:text-xl md:text-2xl font-bold text-white break-words">{aggregates.totalItems}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-blue-500/20">
              <div className="text-slate-400 text-sm">Total Item Cost</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-white break-words">PHP {aggregates.totalItemCost.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 text-center border border-purple-500/20">
              <div className="text-slate-400 text-sm">Estimated Revenue</div>
              <div className="text-sm sm:text-lg md:text-xl lg:text-2xl font-bold text-white break-words">PHP {aggregates.estRevenue.toFixed(2)}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm">Avg Items / Event</div>
              <div className="text-xl font-semibold text-white">{aggregates.avgItemsPerEvent.toFixed(1)}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm">Avg Cost / Event</div>
              <div className="text-xl font-semibold text-white">PHP {aggregates.avgCostPerEvent.toFixed(2)}</div>
            </div>
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
              <div className="text-slate-400 text-sm">Events With Items</div>
              <div className="text-xl font-semibold text-white">{new Set(items.map(i => i.event_id)).size}</div>
            </div>
          </div>

          {/* Attendance Overview Pie */}
          {mounted && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600 md:col-span-1">
                <h3 className="text-lg font-semibold text-white mb-3">Attendance Overview</h3>
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
                <div className="mt-3 text-sm text-slate-300">
                  Avg Rating: <span className="font-semibold">{aggregates.avgRating.toFixed(1)}/5</span>
                </div>
              </div>

            {/* Cost over Time */}
            <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600 md:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-3">Total Item Cost Over Time</h3>
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
          <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3">Cost vs Expected Attendees</h3>
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
          <div className="bg-slate-800/60 rounded-lg p-4 border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-3">Top Events by Total Item Cost</h3>
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

          {/* Descriptive analytics */}
          <div className="bg-slate-800/60 rounded-lg p-4 border border-purple-500/20">
            <h3 className="text-lg font-semibold text-purple-400 mb-2">Descriptive Analytics</h3>
            
            {/* Usage Info */}
            {insightsUsageInfo && (
              <div className="mb-4 p-3 bg-slate-700/50 border border-slate-600 rounded-lg">
                <p className="text-xs text-slate-300">
                  Insights generated this week: {insightsUsageInfo.insightsGenerated}/{insightsUsageInfo.maxInsights}
                  {!insightsUsageInfo.canGenerateMore && (
                    <span className="text-red-400 ml-2">(Limit reached)</span>
                  )}
                </p>
              </div>
            )}
            
            {aiInsights ? (
              <div className="space-y-2">
                <textarea
                  value={aiInsights}
                  onChange={(e) => setAiInsights(e.target.value)}
                  className="w-full min-h-[120px] p-3 bg-slate-700/50 border border-slate-600 rounded-lg text-slate-200 leading-relaxed resize-vertical focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Generated insights will appear here..."
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
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
              <p className="text-slate-400">Generate a narrative summary across your selected scope.</p>
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
                  'Generate Insights'
                )}
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-slate-400">No events to analyze.</div>
      )}
    </div>
  );
}
