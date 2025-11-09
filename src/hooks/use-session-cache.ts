/**
 * useSessionCache Hook
 * Provides cached user session for dashboards and analytics pages
 * Ensures only one session fetch per render pass
 */

import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { getCachedSession, clearSessionCache } from "@/lib/session-cache";
import { useAuth } from "@/context/auth-context";

/**
 * Hook to get cached user session
 * Use this in dashboards/analytics pages where multiple components need user session
 * This ensures only one session fetch happens per render pass
 */
export function useSessionCache() {
  const { user: contextUser, loading: contextLoading } = useAuth();
  const [cachedUser, setCachedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If context already has user, use it
    if (contextUser) {
      setCachedUser(contextUser);
      setLoading(false);
      return;
    }

    // If context is still loading, wait
    if (contextLoading) {
      return;
    }

    // If context has no user, try cached session
    let cancelled = false;

    const fetchCachedSession = async () => {
      try {
        const user = await getCachedSession();
        if (!cancelled) {
          setCachedUser(user);
        }
      } catch (error) {
        console.error("Error fetching cached session:", error);
        if (!cancelled) {
          setCachedUser(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchCachedSession();

    return () => {
      cancelled = true;
    };
  }, [contextUser, contextLoading]);

  // Clear cache when user changes
  useEffect(() => {
    if (contextUser !== cachedUser) {
      clearSessionCache();
    }
  }, [contextUser, cachedUser]);

  return {
    user: cachedUser || contextUser,
    loading: loading || contextLoading,
  };
}

