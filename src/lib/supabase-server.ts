/**
 * Server-side Supabase client for static generation
 * This client is used in generateStaticParams and other server-side operations
 */
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client for static generation (no auth required for public data)
// Use admin client to bypass RLS and avoid infinite recursion errors
export function createServerSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let cookieStore: ReturnType<typeof cookies> | null = null;

  try {
    cookieStore = cookies();
  } catch {
    cookieStore = null;
  }

  if (cookieStore) {
    return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore?.getAll?.() ?? [];
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore?.set?.(name, value, options);
            });
          } catch {
            // noop – cookies() may be read-only in some contexts
          }
        },
      },
    });
  }

  if (serviceKey) {
    return createClient<Database>(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
      },
    });
  }

  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
    },
  });
}

// Admin client for bypassing RLS (use with caution)
export function createAdminSupabaseClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient<Database>(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
    },
  });
}

