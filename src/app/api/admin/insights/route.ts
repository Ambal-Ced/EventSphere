export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
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

    // Try cookie session; fallback to Bearer token
    const {
      data: { session },
    } = await supabase.auth.getSession();

    let userId: string | null = session?.user?.id ?? null;

    if (!userId) {
      const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
      const token = authHeader?.toLowerCase().startsWith("bearer ") ? authHeader.slice(7) : undefined;
      if (token) {
        const anon = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data: u } = await anon.auth.getUser(token);
        userId = u.user?.id ?? null;
      }
    }

    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Admin check via SECURITY DEFINER function (bypasses RLS)
    try {
      const { data: isAdmin } = await supabase.rpc("admin_is_admin", { p_user_id: userId });
      if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    } catch (e) {
      // Fallback to direct check if RPC is unavailable
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", userId)
        .single();
      if (profileError || profile?.account_type !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const body = await request.json();
    const { prompt, context } = body ?? {};

    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        text: "AI is not configured on this deployment. Set your API key to enable admin insights.",
      });
    }

    const resp = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-a-03-2025",
        // Cohere v1/chat expects a single 'message' plus optional 'preamble' or 'chat_history'
        preamble: "You are an analytics assistant for an events platform. Be concise and specific with numbers. Currency is PHP unless stated. Analyze the data and tell me about it in a professional way.",
        message: `Context: ${JSON.stringify(context)}\n\nQuestion: ${prompt}`,
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }
    const data = await resp.json();
    const text = data?.text || data?.message?.content?.[0]?.text || "";

    // Save generated insight using service role (avoids cookie auth dependence)
    try {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const saver = serviceKey
        ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
        : supabase;

      const { data: insertRes, error: insertErr } = await saver
        .from("admin_insights")
        .insert({ user_id: userId, content: text, context })
        .select("id, created_at")
        .single();
      if (insertErr) {
        console.warn("Failed to save admin insight:", insertErr);
        return NextResponse.json({ text, saved: false });
      }
      const res = NextResponse.json({ text, saved: true, id: insertRes.id, created_at: insertRes.created_at });
      res.headers.set("Cache-Control", "no-store");
      return res;
    } catch (saveErr: any) {
      console.warn("Save admin insight exception:", saveErr);
      const res = NextResponse.json({ text, saved: false });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }
  } catch (err: any) {
    console.error("/api/admin/insights error", err);
    const res = NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }
}


