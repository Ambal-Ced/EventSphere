"use client";
import { useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

// Use shared singleton client from lib

export default function VerifiedPage() {
  useEffect(() => {
    // Always sign out the user on this page
    supabase.auth.signOut();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-4">Email Verified!</h1>
        <p className="mb-6 text-muted-foreground">
          Your email has been successfully verified.
          <br />
          Please continue to complete your profile.
        </p>
        <Link href="/complete-profile">
          <button className="w-full bg-primary text-white py-2 rounded hover:bg-primary/90 transition">
            Continue
          </button>
        </Link>
      </div>
    </div>
  );
}
