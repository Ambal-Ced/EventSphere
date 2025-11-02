"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PublicFeedbackPage() {
  const params = useParams();
  const token = (params?.token as string) || "";

  const [loading, setLoading] = useState(true);
  const [portal, setPortal] = useState<any>(null);
  const [event, setEvent] = useState<any>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rating, setRating] = useState<number>(1);
  const [sentiment, setSentiment] = useState<"positive" | "neutral" | "negative" | "">("");
  const [comments, setComments] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Clean and normalize the token
        const normalizedToken = token?.trim();
        if (!normalizedToken) {
          setPortal(null);
          setEvent(null);
          return;
        }
        
        // First, check if portal exists (regardless of status)
        const { data: p, error: portalError } = await supabase
          .from("feedback_portals")
          .select("*")
          .eq("token", normalizedToken)
          .maybeSingle();
        
        if (portalError) {
          console.error("Error fetching portal:", portalError);
          setPortal(null);
          setEvent(null);
          return;
        }
        
        // Check if portal exists, is active, and is not expired
        if (p) {
          // Check if portal is active
          if (!p.is_active) {
            console.warn("Portal found but is not active:", normalizedToken);
            setPortal(null);
            setEvent(null);
            return;
          }
          
          const now = new Date();
          const expiresAt = p.expires_at ? new Date(p.expires_at) : null;
          
          // If portal has expiration and it's expired, don't set it
          if (expiresAt && expiresAt < now) {
            console.warn("Portal found but is expired:", normalizedToken);
            setPortal(null);
            setEvent(null);
            return;
          }
          
          setPortal(p);
          
          // Now fetch the event separately
          if (p.event_id) {
            const { data: eventData, error: eventError } = await supabase
              .from("events")
              .select("id,title,description,location,date")
              .eq("id", p.event_id)
              .maybeSingle();
            
            if (eventError) {
              console.error("Error fetching event:", eventError);
            }
            
            setEvent(eventData || null);
          } else {
            setEvent(null);
          }
        } else {
          setPortal(null);
          setEvent(null);
        }
      } catch (err: any) {
        console.error("Unexpected error:", err);
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
      // Ensure rating stays within [1,5]
      const safeRating = Math.min(5, Math.max(1, Number.isFinite(rating) ? rating : 1));
      const { error } = await supabase.from("feedback_responses").insert({
        portal_id: portal.id,
        event_id: event.id,
        respondent_name: name || null,
        respondent_email: email || null,
        rating: safeRating,
        sentiment: sentiment || null,
        comments: comments || null,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      });
      if (error) {
        setErrorMsg(error.message || "Failed to submit feedback.");
        return;
      }


      setSubmitted(true);
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong while submitting.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-6 text-center text-slate-300">Loading...</div>;
  if (!portal || !event) {
    return (
      <div className="p-6 text-center text-red-400 space-y-2">
        <div className="font-semibold">This feedback link is invalid or expired.</div>
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
        <div className="bg-green-900/30 border border-green-700 text-green-300 p-4 rounded">Thank you for your feedback!</div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-slate-800/60 border border-slate-600 rounded-lg p-5">
          {errorMsg ? (
            <div className="bg-red-900/30 border border-red-700 text-red-300 p-3 rounded">{errorMsg}</div>
          ) : null}
          <div>
            <Label>Your Name (optional)</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input type="email" value={email} onChange={(e)=>setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Rating (1-5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={Number.isFinite(rating) ? rating : 1}
              onChange={(e)=>{
                const v = parseInt(e.target.value, 10);
                if (Number.isNaN(v)) {
                  setRating(1);
                } else {
                  setRating(Math.min(5, Math.max(1, v)));
                }
              }}
              required
            />
          </div>
          <div>
            <Label>Sentiment</Label>
            <Select value={sentiment} onValueChange={(v: any) => setSentiment(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select sentiment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="neutral">Neutral</SelectItem>
                <SelectItem value="negative">Negative</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Comments</Label>
            <textarea className="w-full min-h-[120px] rounded border bg-transparent p-2" value={comments} onChange={(e)=>setComments(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>{submitting ? "Submitting..." : "Submit Feedback"}</Button>
        </form>
      )}
    </div>
  );
}


