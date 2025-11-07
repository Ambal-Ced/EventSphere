export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

type ActionType = "approve" | "deny";

function getEndOfMonthDate(): string {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
  return end.toISOString();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action: ActionType | undefined = body?.action;
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;
    const allPending: boolean = Boolean(body?.all_pending);

    if (!action || !["approve", "deny"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (!allPending && (!ids || ids.length === 0)) {
      return NextResponse.json({ error: "No request IDs provided" }, { status: 400 });
    }

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
    let actingUserId: string | null = session?.user?.id ?? null;

    if (!actingUserId) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const anonClient = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: tokenUser } = await anonClient.auth.getUser(token);
        actingUserId = tokenUser?.user?.id ?? null;
      }
    }

    if (!actingUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminError } = await supabase.rpc("admin_is_admin", { p_user_id: actingUserId });
      if (adminError) {
        console.error("account-deletion update admin RPC error", adminError);
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (rpcErr) {
      console.error("account-deletion update admin RPC throw", rpcErr);
    }

    if (!isAdmin) {
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", actingUserId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } catch (profileErr) {
        console.error("account-deletion update admin profile fallback error", profileErr);
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY missing for account deletion update endpoint");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    type RequestRow = {
      id: string;
      user_id: string | null;
      user_email: string | null;
      status: string | null;
      scheduled_deletion_date: string | null;
      cancelled_at: string | null;
    };

    let targetRequests: RequestRow[] = [];

    if (allPending) {
      const { data: pendingRows, error: pendingError } = await db
        .from("account_deletion_requests")
        .select("id, user_id, user_email, status, scheduled_deletion_date, cancelled_at")
        .eq("status", "pending");
      if (pendingError) {
        console.error("account-deletion update fetch pending error", pendingError);
        throw pendingError;
      }
      targetRequests = pendingRows || [];
    } else {
      const { data: rows, error: rowsError } = await db
        .from("account_deletion_requests")
        .select("id, user_id, user_email, status, scheduled_deletion_date, cancelled_at")
        .in("id", ids!);
      if (rowsError) {
        console.error("account-deletion update fetch selected error", rowsError);
        throw rowsError;
      }
      targetRequests = rows || [];
    }

    if (targetRequests.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No matching pending requests found" });
    }

    const pendingIds = targetRequests
      .filter((row) => (row.status ?? "").toLowerCase() === "pending")
      .map((row) => row.id);

    if (pendingIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0, message: "No pending requests to update" });
    }

    const scheduledDate = action === "approve" ? getEndOfMonthDate() : null;

    const updateRows = targetRequests
      .filter((row) => pendingIds.includes(row.id))
      .map((row) => ({
        id: row.id,
        status: action === "approve" ? "approved" : "denied",
        cancelled_at: action === "deny" ? new Date().toISOString() : row.cancelled_at,
        scheduled_deletion_date: action === "approve" ? scheduledDate : row.scheduled_deletion_date,
        updated_at: new Date().toISOString(),
      }));

    const { data: updatedRows, error: updateError } = await db
      .from("account_deletion_requests")
      .upsert(updateRows, { onConflict: "id" })
      .select("id, user_id, user_email, scheduled_deletion_date");

    if (updateError) {
      console.error("account-deletion update update error", updateError);
      throw updateError;
    }

    const updated = updatedRows || [];

    if (updated.length > 0) {
      const notifications = updated
        .filter((row) => row.user_id)
        .map((row) => {
          const scheduled = row.scheduled_deletion_date;
          const scheduledDisplay = scheduled
            ? new Date(scheduled).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
            : null;
          if (action === "approve") {
            return {
              user_id: row.user_id!,
              type: "account_deletion",
              title: "Account deletion approved",
              message: `Your account deletion request has been approved and is scheduled for deletion on ${scheduledDisplay}.`,
              level: "info",
              link_url: null,
              metadata: {
                request_id: row.id,
                action,
                scheduled_deletion_date: scheduled,
              },
            };
          }
          return {
            user_id: row.user_id!,
            type: "account_deletion",
            title: "Account deletion request denied",
            message: "Your account deletion request has been denied due to circumstances. Please contact us for more details and instructions.",
            level: "warning",
            link_url: null,
            metadata: {
              request_id: row.id,
              action,
            },
          };
        });

      if (notifications.length > 0) {
        const { error: notificationError } = await db
          .from("notifications")
          .insert(notifications.map((n) => ({ ...n, metadata: n.metadata ?? {} })));
        if (notificationError) {
          console.error("account-deletion update notification error", notificationError);
        }
      }
    }

    return NextResponse.json({
      success: true,
      updated: updated.length,
      action,
      message: action === "approve"
        ? `${updated.length} request${updated.length === 1 ? "" : "s"} approved and scheduled`
        : `${updated.length} request${updated.length === 1 ? "" : "s"} denied`,
    });
  } catch (err: any) {
    console.error("/api/admin/account-deletion-requests/update error", err);
    return NextResponse.json({
      error: err?.message ?? "Server error",
    }, { status: 500 });
  }
}

