"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

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
          <button className="px-3 py-2 text-sm font-medium rounded-t-md bg-background border-b-2 border-primary">
            EventTria
          </button>
          <button className="px-3 py-2 text-sm font-medium rounded-t-md hover:text-primary">
            Feedback
          </button>
          <button className="px-3 py-2 text-sm font-medium rounded-t-md hover:text-primary">
            Account Review
          </button>
        </div>
      </div>

      <div className="rounded-lg border p-6 text-sm text-muted-foreground">
        This section is intentionally empty for now. Content coming soon.
      </div>
    </div>
  );
}

