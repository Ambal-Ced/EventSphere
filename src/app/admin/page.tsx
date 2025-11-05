"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import { TrendingUp, Users, Calendar, DollarSign, Package, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "account_review">("eventtria");
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");

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

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Calculate date range
      let startDate: string | null = null;
      if (dateRange !== "all") {
        const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
        const date = new Date();
        date.setDate(date.getDate() - days);
        startDate = date.toISOString();
      }

      const url = new URL("/api/admin/analytics", window.location.origin);
      if (startDate) url.searchParams.set("start", startDate);

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
  };

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics();
    }
  }, [isAdmin, dateRange]);

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

  const formatCurrency = (cents: number) => {
    return `₱${(cents / 100).toFixed(2)}`;
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
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
            onChange={(e) => setDateRange(e.target.value as "7d" | "30d" | "90d" | "all")}
            className="rounded-md border px-3 py-2 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
          <Button onClick={fetchAnalytics} disabled={loadingAnalytics} variant="outline" size="sm">
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
          {loadingAnalytics ? (
            <div className="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
              Loading analytics...
            </div>
          ) : analyticsData ? (
            <>
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
                    of {formatNumber(analyticsData.totals?.subscriptions || 0)} total
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
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
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
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
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
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `₱${(value / 100).toFixed(0)}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
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
                      <XAxis dataKey="date" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
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
                    <BarChart data={analyticsData.subscription_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Subscribers" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue by Subscription Plan */}
                <div className="rounded-lg border p-6 bg-card">
                  <h3 className="text-lg font-semibold mb-4">Revenue by Subscription Plan</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={analyticsData.subscription_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => `₱${(value / 100).toFixed(0)}`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Legend />
                      <Bar dataKey="revenue_cents" fill="#10b981" name="Revenue" />
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
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {analyticsData.subscription_breakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
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
