/**
 * Session Cache
 * Provides a cached user session for the current render pass
 * This prevents multiple components from fetching the same session
 * Useful for dashboards and analytics pages with multiple components
 */

import { User } from "@supabase/supabase-js";

// Cache for the current render pass
let sessionCache: {
  user: User | null;
  timestamp: number;
  promise: Promise<User | null> | null;
} | null = null;

const CACHE_DURATION = 5000; // 5 seconds

/**
 * Get cached user session
 * If a session fetch is already in progress, returns the same promise
 * This ensures only one session fetch happens per render pass
 */
export async function getCachedSession(): Promise<User | null> {
  const now = Date.now();

  // Return cached session if still valid
  if (sessionCache && (now - sessionCache.timestamp) < CACHE_DURATION) {
    if (sessionCache.promise) {
      return sessionCache.promise;
    }
    return Promise.resolve(sessionCache.user);
  }

  // Create new cache entry with promise
  const { supabase } = await import("@/lib/supabase");
  const promise = supabase.auth.getUser().then(({ data: { user }, error }) => {
    if (error) {
      sessionCache = { user: null, timestamp: now, promise: null };
      return null;
    }
    sessionCache = { user, timestamp: now, promise: null };
    return user;
  });

  sessionCache = {
    user: null,
    timestamp: now,
    promise,
  };

  return promise;
}

/**
 * Clear the session cache
 * Useful when user logs out or session changes
 */
export function clearSessionCache() {
  sessionCache = null;
}

/**
 * Get cached user (synchronous if available)
 * Returns null if cache is not available or expired
 */
export function getCachedUserSync(): User | null {
  if (!sessionCache) return null;
  const now = Date.now();
  if ((now - sessionCache.timestamp) >= CACHE_DURATION) return null;
  return sessionCache.user;
}

