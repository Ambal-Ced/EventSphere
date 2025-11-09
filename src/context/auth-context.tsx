"use client";

import { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Memoized auth methods to prevent unnecessary re-renders
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  // Memoized context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    user,
    loading,
    signIn,
    signUp,
    signOut,
  }), [user, loading, signIn, signUp, signOut]);

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000; // 1 second

    // Check active sessions with retry logic for network issues
    const initializeAuth = async (attempt = 1): Promise<void> => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (mounted) {
          if (error) {
            // Only log out on auth errors, not network errors
            // Network errors (like timeout) should retry
            const isNetworkError = error.message?.includes('fetch') || 
                                   error.message?.includes('timeout') ||
                                   error.message?.includes('network') ||
                                   error.name === 'NetworkError';
            
            if (isNetworkError && attempt < MAX_RETRIES) {
              // Retry on network errors
              retryCount = attempt;
              setTimeout(() => {
                if (mounted) {
                  initializeAuth(attempt + 1);
                }
              }, RETRY_DELAY * attempt);
              return;
            }
            
            // Only set user to null on actual auth errors (not network issues)
            if (!isNetworkError) {
              console.error("Session error:", error);
              setUser(null);
            }
            // On network errors after retries, keep current user state
            setLoading(false);
          } else {
            setUser(session?.user ?? null);
            setLoading(false);
            retryCount = 0; // Reset retry count on success
          }
        }
      } catch (err: any) {
        if (mounted) {
          // Check if it's a network error
          const isNetworkError = err?.message?.includes('fetch') || 
                                 err?.message?.includes('timeout') ||
                                 err?.message?.includes('network') ||
                                 err?.name === 'NetworkError' ||
                                 err?.code === 'ECONNRESET' ||
                                 err?.code === 'ETIMEDOUT';
          
          if (isNetworkError && attempt < MAX_RETRIES) {
            // Retry on network errors
            retryCount = attempt;
            setTimeout(() => {
              if (mounted) {
                initializeAuth(attempt + 1);
              }
            }, RETRY_DELAY * attempt);
            return;
          }
          
          // Only log out on non-network errors
          if (!isNetworkError) {
            console.error("Failed to get session:", err);
            setUser(null);
          }
          // On network errors after retries, keep current user state
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for changes on auth state (logged in, signed out, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (mounted) {
        setUser(session?.user ?? null);
        setLoading(false);
        retryCount = 0; // Reset retry count on auth state change
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
