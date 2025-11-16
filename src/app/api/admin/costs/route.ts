export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 30; // Revalidate every 30 seconds

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  try {
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

    // Admin check
    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (adminCheckError) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (e) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .single();
      isAdmin = profile?.account_type === "admin";
    }
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }
    
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    let query = db.from("admin_costs").select("*").order("date_incurred", { ascending: false });

    if (start) query = query.gte("date_incurred", start);
    if (end) query = query.lte("date_incurred", end);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching admin costs:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const response = NextResponse.json({ costs: data || [] });
    response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return response;
  } catch (error: any) {
    console.error("Error in GET /api/admin/costs:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Admin check
    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (adminCheckError) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (e) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .single();
      isAdmin = profile?.account_type === "admin";
    }
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }
    
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const body = await request.json();
    const { cost_type, description, amount_cents, currency, date_incurred, metadata } = body;

    if (!cost_type || !amount_cents) {
      return NextResponse.json({ error: "cost_type and amount_cents are required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("admin_costs")
      .insert({
        cost_type,
        description,
        amount_cents: Math.round(amount_cents),
        currency: currency || 'PHP',
        date_incurred: date_incurred || new Date().toISOString().split('T')[0],
        metadata,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating admin cost:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ cost: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("Error in POST /api/admin/costs:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
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

    // Admin check
    let isAdmin = false;
    try {
      const { data: adminCheck, error: adminCheckError } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (adminCheckError) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", userId)
          .single();
        isAdmin = profile?.account_type === "admin";
      } else {
        isAdmin = adminCheck === true;
      }
    } catch (e) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .single();
      isAdmin = profile?.account_type === "admin";
    }
    
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
    }
    
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const { searchParams } = new URL(request.url);
    const costId = searchParams.get("id");

    if (!costId) {
      return NextResponse.json({ error: "id parameter is required" }, { status: 400 });
    }

    const { error } = await db
      .from("admin_costs")
      .delete()
      .eq("id", costId);

    if (error) {
      console.error("Error deleting admin cost:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("Error in DELETE /api/admin/costs:", error);
    return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
  }
}

