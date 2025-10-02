"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Use shared singleton client from lib

export default function ResetPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", username: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    if (error) setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      // Verify profile details match
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, username, contact_no, email")
        .eq("email", form.email)
        .eq("username", form.username)
        .eq("contact_no", form.phone)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setError("We couldn't verify these details. Please check and try again.");
        return;
      }

      // Send password reset email
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        form.email,
        { redirectTo: `${window.location.origin}/login` }
      );
      if (resetError) throw resetError;
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to start password reset.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 py-12 px-4">
      <div className="w-full max-w-md rounded-lg bg-background p-8 shadow-lg">
        <h1 className="mb-2 text-center text-3xl font-bold">Reset Password</h1>
        <p className="mb-8 text-center text-muted-foreground">
          Confirm your details and we'll send a reset link to your email.
        </p>

        {success ? (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              If the information matched, a reset link has been sent to your
              email. Please check your inbox.
            </p>
            <Button className="w-full" onClick={() => router.push("/login")}>Go to Login</Button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive">
                {error}
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
              />
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="w-1/3" onClick={() => router.push("/login")}>Cancel</Button>
              <Button type="submit" className="w-2/3" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


