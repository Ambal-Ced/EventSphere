export const revalidate = 120;
export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type StatusKey = "pending" | "scheduled" | "cancelled" | "deleted" | "completed" | "approved" | "denied" | "unknown";

const NORMALIZED_STATUS: Record<string, StatusKey> = {
  pending: "pending",
  scheduled: "scheduled",
  scheduling: "scheduled",
  cancelled: "cancelled",
  canceled: "cancelled",
  deleted: "deleted",
  complete: "completed",
  completed: "completed",
  approved: "approved",
  approval: "approved",
  deny: "denied",
  denied: "denied",
};

const MAX_REASON_BUCKETS = 6;

function normaliseStatus(status: string | null): StatusKey {
  if (!status) return "unknown";
  const key = status.trim().toLowerCase();
  return NORMALIZED_STATUS[key] ?? "unknown";
}

function formatMonthKey(date: string | null | undefined): string | null {
  if (!date) return null;
  const dt = new Date(date);
  if (Number.isNaN(dt.getTime())) return null;
  return `${dt.toLocaleString("default", { month: "short" })} ${dt.getFullYear()}`;
}

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
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
        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: userResult } = await anonClient.auth.getUser(token);
        userId = userResult.user?.id ?? null;
      }
    }

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let isAdmin = false;
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (rpcError) {
        console.error("account-deletion-requests admin RPC error", rpcError);
      } else {
        isAdmin = rpcResult === true;
      }
    } catch (rpcErr) {
      console.error("account-deletion-requests admin RPC throw", rpcErr);
    }

    if (!isAdmin) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } catch (profileErr) {
        console.error("account-deletion-requests admin profile fallback error", profileErr);
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY missing for account deletion admin endpoint");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { data: rows, error } = await db
      .from("account_deletion_requests")
      .select(
        "id, user_id, user_email, status, deletion_reason, requested_at, scheduled_deletion_date, cancelled_at, deleted_at"
      )
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("account-deletion-requests fetch error", error);
      throw error;
    }

    const statusCounts: Record<StatusKey, number> = {
      pending: 0,
      scheduled: 0,
      cancelled: 0,
      deleted: 0,
      completed: 0,
      approved: 0,
      denied: 0,
      unknown: 0,
    };

    const reasonCounts: Record<string, number> = {};
    const monthCounts: Record<string, number> = {};

    let pendingCount = 0;

    (rows || []).forEach((row: any) => {
      const status = normaliseStatus(row.status);
      statusCounts[status] = (statusCounts[status] ?? 0) + 1;

      if (status === "pending") {
        pendingCount += 1;
      }

      const reason = (row.deletion_reason?.trim() || "Unspecified").slice(0, 140);
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;

      const monthKey = formatMonthKey(row.requested_at);
      if (monthKey) {
        monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
      }
    });

    const totalRequests = (rows || []).length;

    const statusDistribution = Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        status,
        label: status.charAt(0).toUpperCase() + status.slice(1),
        count,
        percentage: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const sortedReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1]);

    const primaryReasons = sortedReasons.slice(0, MAX_REASON_BUCKETS - 1);
    const remainder = sortedReasons.slice(MAX_REASON_BUCKETS - 1);
    const reasonDistribution = [...primaryReasons];
    if (remainder.length > 0) {
      const otherTotal = remainder.reduce((acc, [, count]) => acc + count, 0);
      reasonDistribution.push(["Other", otherTotal]);
    }

    const reasonData = reasonDistribution.map(([reason, count]) => ({
      reason,
      count,
    }));

    const monthData = Object.entries(monthCounts)
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => {
        const aDate = new Date(a.month);
        const bDate = new Date(b.month);
        return aDate.getTime() - bDate.getTime();
      });

    const payload = {
      totalRequests,
      pendingCount,
      statusDistribution,
      reasonDistribution: reasonData,
      monthDistribution: monthData,
      requests: (rows || []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        user_email: row.user_email,
        status: normaliseStatus(row.status),
        deletion_reason: row.deletion_reason,
        requested_at: row.requested_at,
        scheduled_deletion_at: row.scheduled_deletion_date,
        scheduled_deletion_date: row.scheduled_deletion_date,
        cancelled_at: row.cancelled_at,
        deleted_at: row.deleted_at,
      })),
      debug: {
        usedServiceRole: true,
      },
    };

    const response = NextResponse.json(payload);
    response.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return response;
  } catch (err: any) {
    console.error("/api/admin/account-deletion-requests error", err);
    return NextResponse.json({
      error: err?.message ?? "Server error",
    }, { status: 500 });
  }
}

