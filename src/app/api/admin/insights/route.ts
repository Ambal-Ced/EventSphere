import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function POST(request: NextRequest) {
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

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("account_type")
      .eq("id", session.user.id)
      .single();
    if (profileError || profile?.account_type !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { prompt, context } = body ?? {};

    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        text: "AI is not configured on this deployment. Set COHERE_API_KEY to enable admin insights.",
      });
    }

    const resp = await fetch("https://api.cohere.ai/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "command-r-plus",
        messages: [
          { role: "system", content: "You are an analytics assistant for an events platform. Be concise and specific with numbers. Currency is PHP unless stated." },
          { role: "user", content: `Context: ${JSON.stringify(context)}\n\nQuestion: ${prompt}` },
        ],
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return NextResponse.json({ error: t }, { status: 500 });
    }
    const data = await resp.json();
    const text = data?.text || data?.message?.content?.[0]?.text || "";
    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("/api/admin/insights error", err);
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


