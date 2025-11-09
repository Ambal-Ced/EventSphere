/**
 * Server-side Supabase client for static generation
 * This client is used in generateStaticParams and other server-side operations
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side client for static generation (no auth required for public data)
// Use admin client to bypass RLS and avoid infinite recursion errors
export function createServerSupabaseClient() {
  // Try to use service role key first to bypass RLS for static generation
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey) {
    return createClient<Database>(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
      },
    });
  }
  // Fallback to anon key if service role key is not available
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

