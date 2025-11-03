"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<"eventtria" | "feedback" | "account_review">("eventtria");
  const [profilesCount, setProfilesCount] = useState<number>(0);
  const [eventsCount, setEventsCount] = useState<number>(0);
  const [transactionsCount, setTransactionsCount] = useState<number>(0);
  const [subscriptionsCount, setSubscriptionsCount] = useState<number>(0);

  const loadProfilesCount = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/count/profiles", {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
      });
      const json = await res.json();
      if (res.ok) setProfilesCount(json.count ?? 0);
    } catch {}
  };

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

  useEffect(() => {
    if (isAdmin) {
      loadProfilesCount();
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/admin/count/events", {
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          const json = await res.json();
          if (res.ok) setEventsCount(json.count ?? 0);
        } catch {}
      })();
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/admin/count/user-subscriptions", {
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          const json = await res.json();
          if (res.ok) setSubscriptionsCount(json.count ?? 0);
        } catch {}
      })();
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const res = await fetch("/api/admin/count/transactions", {
            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
          });
          const json = await res.json();
          if (res.ok) setTransactionsCount(json.count ?? 0);
        } catch {}
      })();
    }
  }, [isAdmin]);

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
        <div className="rounded-lg border p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-2">Total Users (profiles)</div>
              <div className="text-3xl font-semibold">{profilesCount.toLocaleString()}</div>
              <div className="mt-4 text-xs text-muted-foreground">
                This shows the total count of rows in the `profiles` table.
                <button onClick={loadProfilesCount} className="ml-3 inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted">Refresh</button>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-2">Total Events (events)</div>
              <div className="text-3xl font-semibold">{eventsCount.toLocaleString()}</div>
              <div className="mt-4 text-xs text-muted-foreground">
                This shows the total count of rows in the `events` table.
                <button
                  onClick={async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch("/api/admin/count/events", {
                        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                      });
                      const json = await res.json();
                      if (res.ok) setEventsCount(json.count ?? 0);
                    } catch {}
                  }}
                  className="ml-3 inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-2">Total Transactions (transactions)</div>
              <div className="text-3xl font-semibold">{transactionsCount.toLocaleString()}</div>
              <div className="mt-4 text-xs text-muted-foreground">
                This shows the total count of rows in the `transactions` table.
                <button
                  onClick={async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch("/api/admin/count/transactions", {
                        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                      });
                      const json = await res.json();
                      if (res.ok) setTransactionsCount(json.count ?? 0);
                    } catch {}
                  }}
                  className="ml-3 inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted"
                >
                  Refresh
                </button>
              </div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-sm text-muted-foreground mb-2">Total Subscriptions (user_subscriptions)</div>
              <div className="text-3xl font-semibold">{subscriptionsCount.toLocaleString()}</div>
              <div className="mt-4 text-xs text-muted-foreground">
                This shows the total count of rows in the `user_subscriptions` table.
                <button
                  onClick={async () => {
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch("/api/admin/count/user-subscriptions", {
                        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
                      });
                      const json = await res.json();
                      if (res.ok) setSubscriptionsCount(json.count ?? 0);
                    } catch {}
                  }}
                  className="ml-3 inline-flex items-center rounded-md border px-2 py-1 hover:bg-muted"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
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

