export const runtime = 'edge';
export const revalidate = 120;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = (searchParams.get("scope") as "owned" | "joined" | "both") || "owned";

    const cookieStore = await cookies(); // Await cookies in Next.js 15
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll(); },
          setAll(cookiesToSet) { try { cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch {} },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let owned: any[] = [];
    let joined: any[] = [];

    if (scope !== "joined") {
      const { data } = await supabase
        .from("events")
        .select("id,title,date,category")
        .eq("user_id", user.id)
        .order("date", { ascending: false });
      owned = data || [];
    }

    if (scope !== "owned") {
      const { data: collab } = await supabase
        .from("event_collaborators")
        .select("event_id")
        .eq("user_id", user.id);
      const ids = (collab || []).map((r: any) => r.event_id);
      if (ids.length > 0) {
        const { data } = await supabase
          .from("events")
          .select("id,title,date,category")
          .in("id", ids)
          .order("date", { ascending: false });
        joined = data || [];
      }
    }

    const items = scope === "owned" ? owned : scope === "joined" ? joined : Array.from(new Map([...owned, ...joined].map(e => [e.id, e])).values());

    const res = NextResponse.json({ items });
    res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=600");
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


