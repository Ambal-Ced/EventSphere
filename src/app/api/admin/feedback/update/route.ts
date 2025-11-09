export const revalidate = 0; // Don't cache update operations
export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies(); // Await cookies in Next.js 15
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
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
        const { data: u } = await client.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    }
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Admin check via RPC to bypass RLS
    const { data: isAdmin } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
    if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await request.json();
    const { id, status, admin_notes } = body;

    if (!id) {
      return NextResponse.json({ error: "Feedback ID is required" }, { status: 400 });
    }

    // Use service role client for RPC call to bypass triggers
    // This makes auth.uid() NULL in the function, which allows the update
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }

    const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // Use RPC function to bypass triggers and RLS
    // The function uses SECURITY DEFINER to run with elevated privileges
    // Using service role client makes auth.uid() NULL, which the function allows
    const { data: result, error } = await adminClient.rpc("admin_update_feedback", {
      p_feedback_id: id,
      p_status: status !== undefined ? status : null,
      p_admin_notes: admin_notes !== undefined ? admin_notes : null,
    });

    if (error) {
      console.error("Error updating feedback:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!result) {
      return NextResponse.json({ error: "Update failed - no result returned" }, { status: 500 });
    }

    return NextResponse.json({ data: result });
  } catch (err: any) {
    console.error("/api/admin/feedback/update error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}

