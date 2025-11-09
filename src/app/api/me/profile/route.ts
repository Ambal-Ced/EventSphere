export const runtime = 'edge';
export const revalidate = 300;

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function GET(_request: NextRequest) {
  try {
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

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, account_type, created_at")
      .eq("id", user.id)
      .single();
    if (error) throw error;

    const res = NextResponse.json({ profile: data });
    res.headers.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1200");
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Server error" }, { status: 500 });
  }
}


