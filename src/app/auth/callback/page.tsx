"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

// Use shared singleton client from lib

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const type = searchParams.get("type");

  useEffect(() => {
    // Handle code in URL
    const code = searchParams.get("code");
    if (code) {
      // For recovery type, redirect to reset password page which handles it
      if (type === "recovery") {
        router.replace(`/auth/reset-password?code=${encodeURIComponent(code)}&type=recovery`);
        return;
      } else {
        // For other types (like email verification), try code exchange
        supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
          if (error) {
            console.error("Code exchange error:", error);
            router.push("/login?error=invalid_code");
            return;
          }
          if (data?.session) {
            // Code exchange successful, let onAuthStateChange handle the redirect
          }
        });
      }
    }

    // Listen for auth state change (i.e., after hash is processed or code is exchanged)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        // Handle recovery/password reset flow
        if (type === "recovery" && event === "SIGNED_IN" && session) {
          router.push("/auth/reset-password?from=confirmation");
          return;
        }

        if (event === "SIGNED_IN" && session?.user?.email_confirmed_at) {
          // Check if profile exists
          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          const requiredFields = [
            "username",
            "fname",
            "lname",
            "address",
            "contact_no",
            "birthday",
            "gender",
          ];
          const isProfileIncomplete =
            !profile || requiredFields.some((field) => !profile[field]);

          if (profileError || isProfileIncomplete) {
            // Force the user to authenticate (email + password) before completing profile
            router.push("/login?next=/complete-profile");
          } else {
            router.push("/");
          }
        } else if (event === "SIGNED_OUT") {
          router.push("/login");
        }
      }
    );

    // Cleanup
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router, type, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Verifying your email...</h1>
        <p className="text-muted-foreground">
          Please wait while we confirm your email verification.
        </p>
      </div>
    </div>
  );
}
