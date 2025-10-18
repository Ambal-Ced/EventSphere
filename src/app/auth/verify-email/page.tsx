"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const type = searchParams.get("type");

  useEffect(() => {
    const verifyEmail = async () => {
      if (token && type === "email") {
        try {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: "email",
          });

          if (error) {
            console.error("Error verifying email:", error.message);
            router.push("/login?error=verification_failed");
            return;
          }

          // Get the current user's session
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session?.user) {
            // Check if profile exists and is complete
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
              router.push("/complete-profile");
            } else {
              router.push("/");
            }
          }
        } catch (error) {
          console.error("Error during email verification:", error);
          router.push("/login?error=verification_failed");
        }
      }
    };

    verifyEmail();
  }, [token, type, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Verifying your email...</h1>
        <p className="text-muted-foreground">
          Please wait while we verify your email address.
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-muted/40">
        <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-muted-foreground">
            Please wait...
          </p>
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
