"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "account_review">("eventtria");
  const [range, setRange] = useState<{ label: string; start?: string; end?: string }>({ label: "Last 30 days" });
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiText, setAiText] = useState("");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
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
    <div className="container mx-auto max-w-6xl py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Restricted area for administrators</p>
      </div>

      <div className="border-b mb-6">
        <div className="flex gap-4">
          <button onClick={() => setActiveTab("eventtria")} className={`px-3 py-2 text-sm font-medium rounded-t-md ${activeTab === "eventtria" ? "bg-background border-b-2 border-primary" : "hover:text-primary"}`}>
            EventTria
          </button>
          <button onClick={() => setActiveTab("feedback")} className={`px-3 py-2 text-sm font-medium rounded-t-md ${activeTab === "feedback" ? "bg-background border-b-2 border-primary" : "hover:text-primary"}`}>
            Feedback
          </button>
          <button onClick={() => setActiveTab("account_review")} className={`px-3 py-2 text-sm font-medium rounded-t-md ${activeTab === "account_review" ? "bg-background border-b-2 border-primary" : "hover:text-primary"}`}>
            Account Review
          </button>
        </div>
      </div>

      {activeTab === "eventtria" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Range:</span>
            {(
              [
                { label: "Last 7 days", days: 7 },
                { label: "Last 30 days", days: 30 },
                { label: "Last 90 days", days: 90 },
                { label: "All time" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.label}
                onClick={() => {
                  if ("days" in opt) {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(end.getDate() - opt.days);
                    setRange({ label: opt.label, start: start.toISOString(), end: end.toISOString() });
                  } else {
                    setRange({ label: opt.label });
                  }
                }}
                className={`px-3 py-1.5 text-xs rounded-md border ${range.label === opt.label ? "bg-primary text-primary-foreground border-primary" : "hover:bg-muted"}`}
              >
                {opt.label}
              </button>
            ))}
            <button
              onClick={async () => {
                setStatsLoading(true);
                try {
                  const params = new URLSearchParams();
                  if (range.start) params.set("start", range.start);
                  if (range.end) params.set("end", range.end);
                  const res = await fetch(`/api/admin/stats?${params.toString()}`);
                  const json = await res.json();
                  setStats(json);
                } finally {
                  setStatsLoading(false);
                }
              }}
              className="ml-auto px-3 py-1.5 text-xs rounded-md border hover:bg-muted"
            >
              Refresh
            </button>
          </div>

          {statsLoading && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Loading stats…</div>
          )}

          {stats && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Users" value={stats.totals?.profiles ?? 0} />
                <StatCard title="Events" value={stats.totals?.events ?? 0} />
                <StatCard title="Collaborations" value={stats.totals?.collaborations ?? 0} />
                <StatCard title="Transactions" value={stats.totals?.transactions ?? 0} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 rounded-lg border p-4">
                  <div className="mb-2 text-sm font-medium">Revenue ({stats.totals?.currency})</div>
                  <div className="text-2xl font-semibold">
                    ₱{((stats.totals?.revenue_cents ?? 0) / 100).toLocaleString()}
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">Daily revenue over selected range</div>
                  <div className="mt-2 h-32 w-full rounded bg-muted" />
                </div>
                <div className="rounded-lg border p-4">
                  <div className="mb-2 text-sm font-medium">Ask AI about analytics</div>
                  <textarea
                    className="w-full min-h-[100px] rounded-md border bg-background p-2 text-sm"
                    placeholder="Ask anything about revenue, users, events…"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      disabled={!aiPrompt}
                      onClick={async () => {
                        setAiLoading(true);
                        setAiText("");
                        try {
                          const res = await fetch("/api/admin/insights", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ prompt: aiPrompt, context: stats }),
                          });
                          const json = await res.json();
                          setAiText(json.text || json.error || "");
                        } finally {
                          setAiLoading(false);
                        }
                      }}
                      className="px-3 py-1.5 text-xs rounded-md border hover:bg-muted"
                    >
                      Generate insight
                    </button>
                  </div>
                  <div className="mt-3 text-sm whitespace-pre-wrap">{aiLoading ? "Generating…" : aiText}</div>
                  <div className="mt-2 text-xs text-muted-foreground">Admins have no rate limit.</div>
                </div>
              </div>
            </div>
          )}

          {!stats && !statsLoading && (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Choose a range and click Refresh to load analytics.
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

function StatCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-sm text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value.toLocaleString()}</div>
    </div>
  );
}

