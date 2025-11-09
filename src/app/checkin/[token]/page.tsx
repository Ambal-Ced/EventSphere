"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
export default function PublicCheckinPage() {
  const params = useParams();
  // Handle token extraction - decode URL if needed
  const rawToken = (params?.token as string) || "";
  const token = decodeURIComponent(rawToken);

  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Clean and normalize the token
        const normalizedToken = token?.trim();
        console.log("🔵 Checking checkin portal with token:", normalizedToken ? `${normalizedToken.substring(0, 8)}...` : 'missing');
        
        if (!normalizedToken) {
          console.warn("❌ No token provided");
          setPortal(null);
          setEvent(null);
          return;
        }
        
        // Try API route first (bypasses RLS)
        try {
          const apiResponse = await fetch(`/api/portal/checkin/${encodeURIComponent(normalizedToken)}`);
          const apiData = await apiResponse.json();
          
          if (apiResponse.ok && apiData.success) {
            console.log("✅ Portal found via API:", apiData);
            setPortal(apiData.portal);
            setEvent(apiData.event);
            return;
          } else {
            console.warn("⚠️ API route returned error:", apiData);
          }
        } catch (apiErr) {
          console.warn("⚠️ API route failed, falling back to direct query:", apiErr);
        }
        
        // Fallback: Direct query (may fail due to RLS)
        const { data: p, error: portalError } = await supabase
          .from("attendance_portals")
          .select("*")
          .eq("token", normalizedToken)
          .maybeSingle();
        
        console.log("🔵 Portal query result:", { data: p, error: portalError });
        
        if (portalError) {
          console.error("❌ Error fetching portal:", portalError);
          console.error("❌ Portal error details:", {
            message: portalError.message,
            details: portalError.details,
            hint: portalError.hint,
            code: portalError.code
          });
          setPortal(null);
          setEvent(null);
          return;
        }
        
        // Check if portal exists, is active, and is not expired
        if (p) {
          console.log("✅ Portal found:", { id: p.id, is_active: p.is_active, event_id: p.event_id });
          
          // Check if portal is active
          if (!p.is_active) {
            console.warn("⚠️ Portal found but is not active:", normalizedToken);
            setPortal(null);
            setEvent(null);
            return;
          }
          
          const now = new Date();
          const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
          
          // If portal has expiration and it's expired, don't set it
          if (expiresAt && expiresAt < now) {
            console.warn("⚠️ Portal found but is expired:", normalizedToken, "Expires:", expiresAt);
            setPortal(null);
            setEvent(null);
            return;
          }
          
          setPortal(p);
          
          // Now fetch the event separately
          if (p.event_id) {
            console.log("🔵 Fetching event:", p.event_id);
            const { data: eventData, error: eventError } = await supabase
              .from("events")
              .select("id,title,description,location,date")
              .eq("id", p.event_id)
              .maybeSingle();
            
            console.log("🔵 Event query result:", { data: eventData, error: eventError });
            
            if (eventError) {
              console.error("❌ Error fetching event:", eventError);
              console.error("❌ Event error details:", {
                message: eventError.message,
                details: eventError.details,
                hint: eventError.hint,
                code: eventError.code
              });
            }
            
            setEvent(eventData || null);
          } else {
            console.warn("⚠️ Portal has no event_id");
            setEvent(null);
          }
        } else {
          console.warn("❌ Portal not found for token:", normalizedToken);
          setPortal(null);
          setEvent(null);
        }
      } catch (err: any) {
        console.error("❌ Unexpected error:", err);
        console.error("❌ Error stack:", err.stack);
        setPortal(null);
        setEvent(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portal || !event) return;
    setErrorMsg("");
    setSubmitting(true);
    try {
      const { error } = await supabase.from("attendance_records").insert({
        portal_id: portal.id,
        event_id: event.id,
        attendee_name: name,
        attendee_email: email || null,
        note: note || null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (error) {
        setErrorMsg(error.message || "Failed to check in.");
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong while checking in.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-300">Loading...</div>;
  if (!portal || !event) {
    return (
      <div className="p-6 text-center text-red-400 space-y-2">
        <div className="font-semibold">This check-in link is invalid or expired.</div>
        <div className="text-sm text-slate-400">Please contact the event organizer for a new link.</div>
        <div className="text-xs text-slate-500 mt-4">
          <p>Please check the browser console (F12) for detailed error information.</p>
          <p className="mt-2">Token received: {token || '(none)'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="bg-slate-800/60 border border-slate-600 rounded-lg p-5">
        <h1 className="text-2xl font-semibold text-white">{event.title}</h1>
        <p className="text-slate-300 mt-1">{event.description}</p>
        <div className="text-sm text-slate-400 mt-2">
          <div>Date: {event.date ? new Date(event.date).toLocaleString() : "TBA"}</div>
          <div>Location: {event.location || "TBA"}</div>
        </div>
      </div>

      {submitted ? (
        <div className="bg-green-900/30 border border-green-700 text-green-300 p-4 rounded">You're checked in. Enjoy the event!</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-800/60 border border-slate-600 rounded-lg p-5">
          {errorMsg ? (
            <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded">{errorMsg}</div>
          ) : null}
          <div>
            <Label>Your Name</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Note (optional)</Label>
            <textarea className="w-full min-h-[100px] rounded border bg-transparent p-2" value={note} onChange={(e)=>setNote(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Checking in..." : "Check In"}</Button>
        </form>
      )}
    </div>
  );
}


