export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const requestId: string | undefined = body?.request_id;
    const userId: string | undefined = body?.user_id;

    if (!requestId && !userId) {
      return NextResponse.json({ error: "No request ID or user ID provided" }, { status: 400 });
    }

    const cookieStore = await cookies();
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
        console.error("account-deletion delete admin RPC error", adminError);
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (rpcErr) {
      console.error("account-deletion delete admin RPC throw", rpcErr);
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
        console.error("account-deletion delete admin profile fallback error", profileErr);
      }
    }

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      console.error("SUPABASE_SERVICE_ROLE_KEY missing for account deletion delete endpoint");
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    // Get the user_id from the request if not provided
    let targetUserId: string | null = userId || null;
    if (!targetUserId && requestId) {
      const { data: requestData, error: requestError } = await db
        .from("account_deletion_requests")
        .select("user_id, status")
        .eq("id", requestId)
        .single();

      if (requestError) {
        console.error("account-deletion delete fetch request error", requestError);
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      if (!requestData) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 });
      }

      targetUserId = requestData.user_id;
      
      // Verify the request is approved
      if (requestData.status !== "approved") {
        return NextResponse.json({ error: "Request is not approved for deletion" }, { status: 400 });
      }
    }

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID not found" }, { status: 400 });
    }

    // Delete data from all relevant tables in the correct order (respecting foreign key constraints)
    // Order matters: delete child records first, then parent records
    
    const deletionResults: Record<string, { success: boolean; error?: string; count?: number }> = {};
    const finalUserId = targetUserId; // Store in a const for use in closures

    // Helper function to delete from a table
    const deleteFromTable = async (tableName: string, columnName: string = "user_id") => {
      try {
        const { error, count } = await db
          .from(tableName)
          .delete()
          .eq(columnName, finalUserId!);
        
        if (error) {
          console.error(`Error deleting from ${tableName}:`, error);
          deletionResults[tableName] = { success: false, error: error.message };
          return false;
        }
        
        deletionResults[tableName] = { success: true, count: count || 0 };
        return true;
      } catch (err: any) {
        console.error(`Exception deleting from ${tableName}:`, err);
        deletionResults[tableName] = { success: false, error: err.message };
        return false;
      }
    };

    // Delete in order (child tables first, then parent tables)
    // Note: Some tables might not have user_id, so we'll handle those separately
    
    // 1. Delete from child tables that reference user_id
    await deleteFromTable("admin_insights", "user_id");
    await deleteFromTable("event_invites", "user_id");
    await deleteFromTable("event_notes", "user_id");
    await deleteFromTable("event_insights_usage", "user_id");
    await deleteFromTable("event_feedback", "user_id");
    await deleteFromTable("attendance_records", "user_id");
    await deleteFromTable("notifications", "user_id");
    await deleteFromTable("attendees", "user_id");
    await deleteFromTable("admin_notif", "user_id");
    await deleteFromTable("feedback", "user_id");
    await deleteFromTable("event_collaborators", "user_id");
    await deleteFromTable("event_chat", "user_id");
    await deleteFromTable("ai_chat_usage", "user_id");
    await deleteFromTable("notifications_dedupe", "user_id");
    await deleteFromTable("ai_insights_usage", "user_id");
    await deleteFromTable("analytics_insights_usage", "user_id");
    await deleteFromTable("user_usage", "user_id");
    await deleteFromTable("secure_card_data", "user_id");
    await deleteFromTable("user_trial_status", "user_id");
    await deleteFromTable("user_subscriptions", "user_id");
    
    // 2. Delete events created by the user (this will cascade to related data)
    await deleteFromTable("events", "user_id");
    
    // 3. Delete from tables that might reference events (need to delete by event_id first)
    // These are handled by cascade or we need to query events first
    // For now, we'll delete directly if they have user_id
    
    // 4. Delete from tables that might have different column names
    // event_items - might be linked via events (cascade) or have user_id
    // event_revenue - might be linked via events (cascade) or have user_id
    // attendance_portals - might be linked via events (cascade) or have user_id
    // event_script - might be linked via events (cascade) or have user_id
    // feedback_portals - might be linked via events (cascade) or have user_id
    // analytics_insights - might have user_id or be linked differently
    
    // Try to delete from these tables if they have user_id
    await deleteFromTable("event_items", "user_id");
    await deleteFromTable("event_revenue", "user_id");
    await deleteFromTable("attendance_portals", "user_id");
    await deleteFromTable("event_script", "user_id");
    await deleteFromTable("feedback_portals", "user_id");
    await deleteFromTable("analytics_insights", "user_id");
    
    // 5. Delete subscription plans (if user created them)
    await deleteFromTable("subscription_plans", "user_id");
    
    // 6. Delete the account deletion request
    await deleteFromTable("account_deletion_requests", "user_id");
    
    // 7. Finally, delete the profile (this should be last)
    await deleteFromTable("profiles", "id");

    // Check if there were any failures
    const failures = Object.entries(deletionResults).filter(([, result]) => !result.success);
    const successCount = Object.values(deletionResults).filter((r) => r.success).length;
    const totalCount = Object.keys(deletionResults).length;

    if (failures.length > 0) {
      console.warn("Some deletions failed:", failures);
      return NextResponse.json({
        success: false,
        message: `Account deletion partially completed. ${successCount}/${totalCount} tables processed successfully.`,
        results: deletionResults,
        failures: failures.map(([table, result]) => ({ table, error: result.error })),
      }, { status: 207 }); // 207 Multi-Status
    }

    // Update the account deletion request status to "completed"
    if (requestId) {
      await db
        .from("account_deletion_requests")
        .update({ 
          status: "completed",
          deleted_at: new Date().toISOString(),
        })
        .eq("id", requestId);
    }

    return NextResponse.json({
      success: true,
      message: `Account and all associated data deleted successfully. ${successCount} tables processed.`,
      results: deletionResults,
      user_id: finalUserId,
    });
  } catch (err: any) {
    console.error("/api/admin/account-deletion-requests/delete error", err);
    return NextResponse.json({
      error: err?.message ?? "Server error",
    }, { status: 500 });
  }
}

