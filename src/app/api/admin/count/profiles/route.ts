export const revalidate = 120;
export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

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

    // Try cookies-based session first
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let userId: string | null = session?.user?.id ?? null;
    // Fallback: accept Bearer token header
    if (!userId) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const supabaseWithHeader = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: userData } = await supabaseWithHeader.auth.getUser(token);
        userId = userData.user?.id ?? null;
      }
    }
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Admin check using SECURITY DEFINER RPC to avoid RLS issues
    const { data: isAdmin, error: isAdminError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
    if (isAdminError || !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      // Fast path: use service role to count directly
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
      const { count, error } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (error) throw error;
      const res = NextResponse.json({ count: (count as number | null) ?? 0, usedServiceRole: true });
      res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
      return res;
    }

    // Fallback path: use SECURITY DEFINER RPC that bypasses RLS
    const { data: rpcCount, error: rpcError } = await supabase.rpc("admin_count_profiles");
    if (rpcError) throw rpcError;
    {
      const res = NextResponse.json({ count: Number(rpcCount) || 0, usedServiceRole: false, usedRpc: true });
      res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
      return res;
    }
  } catch (err: any) {
    console.error("/api/admin/count/profiles error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


