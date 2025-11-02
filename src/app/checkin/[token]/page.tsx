"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PublicCheckinPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

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
        const { data: p } = await supabase
          .from("attendance_portals")
          .select("*, events(id,title,description,location,date)")
          .eq("token", token)
          .eq("is_active", true)
          .maybeSingle();
        
        // Check if portal exists and is not expired
        if (p) {
          const now = new Date();
          const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
          
          // If portal has expiration and it's expired, don't set it
          if (expiresAt && expiresAt < now) {
            setPortal(null);
            setEvent(null);
          } else {
            setPortal(p);
            setEvent(p.events);
          }
        }
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


