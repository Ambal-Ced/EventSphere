"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function FeedbackPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [events, setEvents] = useState<{ id: string; title: string }[]>([]);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    feedback_type: "bug",
    title: "",
    description: "",
    rating: 5,
    priority: "normal",
    event_id: "",
  });

  // Fetch user's events for dropdown
  useEffect(() => {
    setMounted(true);
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setEvents([]);
          return;
        }
        const { data, error } = await supabase
          .from("events")
          .select("id,title")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setEvents((data || []) as { id: string; title: string }[]);
      } catch (err) {
        console.warn("Failed to load events for feedback:", err);
      } finally {
        setLoadingEvents(false);
      }
    })();
  }, []);

  const maskedEventId = useMemo(() => {
    if (!form.event_id) return "";
    const firstFour = form.event_id.slice(0, 4);
    return `${firstFour}**`;
  }, [form.event_id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Please provide a title and description.");
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("Please sign in to submit feedback.");

      const payload: any = {
        user_id: user.id,
        feedback_type: form.feedback_type,
        title: form.title.trim(),
        description: form.description.trim(),
        rating: Number(form.rating) || null,
        priority: form.priority,
        status: "open",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (form.event_id.trim()) payload.event_id = form.event_id.trim();

      const { data: inserted, error } = await supabase
        .from("feedback")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      if (!inserted) throw new Error("Insert returned no row. Check RLS policies.");
      toast.success("Thank you! Your feedback has been submitted.");
      router.push("/");
    } catch (err: any) {
      console.error("Feedback error:", err);
      toast.error(err.message || "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    !mounted ? (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-6">Send Feedback</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    ) : (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">Send Feedback</h1>
      <p className="text-muted-foreground mb-8">
        Found a bug, have a suggestion, or general comment? Let us know.
      </p>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="feedback_type">Type</Label>
            <select
              id="feedback_type"
              name="feedback_type"
              value={form.feedback_type}
              onChange={handleChange}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="bug">Bug</option>
              <option value="feature">Feature Request</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <Label htmlFor="rating">Rating</Label>
            <select
              id="rating"
              name="rating"
              value={form.rating}
              onChange={handleChange}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            name="title"
            value={form.title}
            onChange={handleChange}
            placeholder="Short summary"
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Tell us what happened or what you'd like to see"
            className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              name="priority"
              value={form.priority}
              onChange={handleChange}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <Label htmlFor="event_id">Event Title</Label>
            <select
              id="event_id"
              name="event_id"
              value={form.event_id}
              onChange={handleChange}
              className="mt-1 w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No related event</option>
              {loadingEvents ? (
                <option value="" disabled>
                  Loading events...
                </option>
              ) : (
                events.map((ev) => (
                  <option key={ev.id} value={ev.id}>
                    {ev.title || ev.id}
                  </option>
                ))
              )}
            </select>
            <div className="mt-3">
              <Label>Event ID</Label>
              <Input value={maskedEventId} readOnly placeholder="No event selected" />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/")}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </form>
    </div>
    )
  );
}


