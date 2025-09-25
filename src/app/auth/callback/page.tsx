"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Listen for auth state change (i.e., after hash is processed)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
  }, [router]);

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
