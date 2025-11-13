"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  Loader2,
  MailCheck,
  ShieldAlert,
  XCircle,
} from "lucide-react";

type Status = "verifying" | "success" | "info" | "error";

function EmailChangeConfirmationContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState<string | null>(null);

  useEffect(() => {
    const processConfirmation = async () => {
      try {
        const hash = window.location.hash;
        const urlParams = new URLSearchParams(hash.substring(1));

        const accessToken =
          urlParams.get("access_token") || searchParams.get("access_token");
        const refreshToken =
          urlParams.get("refresh_token") || searchParams.get("refresh_token");
        const type = urlParams.get("type") || searchParams.get("type");
        const emailSource = urlParams.get("email_source") || searchParams.get("email_source");
        const newEmailParam = urlParams.get("new_email") || searchParams.get("new_email");
        const messageParam =
          urlParams.get("message") || searchParams.get("message");

        if (accessToken && refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (error) {
            throw error;
          }

          if (!data.user) {
            throw new Error("No user information returned with this link.");
          }

          setCurrentEmail(data.user.email ?? null);
          const pendingNewEmail = (data.user as any)?.user_metadata?.pending_email_change || newEmailParam;
          setNewEmail(pendingNewEmail ?? null);
          setStatus("success");

          if (type === "email_change") {
            if (emailSource === "current") {
              setMessage(
                "Current email confirmed! Please check your new email address and click the confirmation link to complete the email change."
              );
            } else if (emailSource === "new") {
              setMessage(
                "New email confirmed! Please check your current email address and click the confirmation link to complete the email change."
              );
            } else {
              setMessage(
                "Email change confirmation received! Please confirm the link sent to your other email address to finish the update."
              );
            }
          } else {
            setMessage(
              "Email change confirmed! You can continue using your updated email address."
            );
          }

          return;
        }

        if (messageParam) {
          const decoded = decodeURIComponent(messageParam);
          setStatus("info");
          if (decoded.includes("Confirmation link accepted")) {
            setMessage(
              "New email confirmed! If you haven't already, please confirm the link sent to your current email address."
            );
          } else {
            setMessage(decoded);
          }
          return;
        }

        throw new Error("Invalid or expired email change link.");
      } catch (error: any) {
        console.error("Email change confirmation error:", error);
        setStatus("error");
        setMessage(
          error?.message || "Failed to confirm email change. Please try again."
        );
      }
    };

    processConfirmation();
  }, [searchParams]);

  const goToSettings = () => router.push("/settings");
  const goHome = () => router.push("/");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
            {status === "verifying" && (
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            )}
            {status === "success" && (
              <CheckCircle className="h-6 w-6 text-green-600" />
            )}
            {status === "info" && <MailCheck className="h-6 w-6 text-blue-600" />}
            {status === "error" && <XCircle className="h-6 w-6 text-red-600" />}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === "verifying" && "Confirming Email Change..."}
            {status === "success" && "Email Change Confirmed!"}
            {status === "info" && "Email Confirmation Received"}
            {status === "error" && "Confirmation Failed"}
          </CardTitle>
          <CardDescription>
            {status === "verifying" &&
              "Please wait while we confirm your email change request."}
            {status === "success" &&
              "Great! We verified the email change request associated with your account."}
            {status === "info" &&
              "We received your confirmation. Follow the instructions below to finish the process."}
            {status === "error" &&
              "We couldn't confirm this email change request."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(status === "success" || status === "info") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
              <p className="font-medium mb-2">Details</p>
              <p className="mb-2">{message}</p>
              {currentEmail && (
                <p className="text-xs text-blue-600">Current email: {currentEmail}</p>
              )}
              {newEmail && (
                <p className="text-xs text-blue-600">New email: {newEmail}</p>
              )}
            </div>
          )}

          {status === "error" && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-800">
              <ShieldAlert className="h-5 w-5 inline mr-2 text-red-600" />
              {message}
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <Button onClick={goToSettings} className="w-full">
              Back to Settings
            </Button>
            <Button variant="outline" onClick={goHome} className="w-full">
              Go to Homepage
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function EmailChangeConfirmationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              </div>
              <CardTitle className="text-2xl font-bold">Loading...</CardTitle>
              <CardDescription>
                Please wait while we load the confirmation page.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      }
    >
      <EmailChangeConfirmationContent />
    </Suspense>
  );
}
