import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Ensure a single Supabase client instance in the browser to avoid multiple GoTrue clients
const globalForSupabase = globalThis as unknown as {
  __supabase?: SupabaseClient<Database>;
};

export const supabase: SupabaseClient<Database> =
  globalForSupabase.__supabase ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "eventsphere.auth",
      detectSessionInUrl: true,
      // Increase timeout for slow networks
      flowType: 'pkce',
    },
    global: { 
      headers: { "x-client": "eventtria-web" },
      // Add fetch timeout handling
      fetch: (url, options = {}) => {
        // Create an AbortController with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
        
        return fetch(url, {
          ...options,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
        });
      },
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForSupabase.__supabase = supabase;
}
