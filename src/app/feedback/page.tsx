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
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [form, setForm] = useState({
    feedback_type: "bug_report",
    title: "",
    description: "",
    rating: 5,
    priority: "medium",
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

  const resetForm = () => {
    setForm({
      feedback_type: "bug_report",
      title: "",
      description: "",
      rating: 5,
      priority: "medium",
      event_id: "",
    });
    setIsSubmitted(false);
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
        rating: form.rating ? Number(form.rating) : null,
        priority: form.priority,
        status: "open",
      };
      // Only add event_id if it's not empty (now as string, not foreign key)
      if (form.event_id && form.event_id.trim()) {
        payload.event_id = form.event_id.trim();
      }
      
      console.log("Feedback payload:", payload);

      // Insert into feedback table
      const { data: inserted, error } = await supabase
        .from("feedback")
        .insert(payload)
        .select()
        .single();
      
      if (error) {
        console.error("Supabase error:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        console.error("Error details:", error.details);
        console.error("Error hint:", error.hint);
        throw new Error(error.message || `Failed to submit feedback: ${error.code || 'Unknown error'}`);
      }
      
      if (!inserted) {
        throw new Error("Insert returned no row. Check RLS policies or database constraints.");
      }


      // If an event was selected, also insert into event_feedback table
      if (form.event_id && form.event_id.trim()) {
        console.log("Inserting event feedback:", {
          feedback_id: inserted.id,
          event_id: form.event_id.trim()
        });
        
        try {
          const { error: eventFeedbackError } = await supabase
            .from("event_feedback")
            .insert({
              feedback_id: inserted.id,
              event_id: form.event_id.trim(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          
          if (eventFeedbackError) {
            console.error("Event feedback error:", eventFeedbackError);
            console.error("Event feedback error details:", {
              message: eventFeedbackError.message,
              details: eventFeedbackError.details,
              hint: eventFeedbackError.hint,
              code: eventFeedbackError.code
            });
            
            // Check if it's a table doesn't exist error
            if (eventFeedbackError.code === '42P01' || eventFeedbackError.message.includes('relation "public.event_feedback" does not exist')) {
              console.warn("event_feedback table doesn't exist yet. Migration may not have been applied.");
              toast.warning("Feedback submitted successfully. Event linking will be available after database migration.");
            } else {
              toast.warning("Feedback submitted, but event linking failed.");
            }
          } else {
            console.log("Event feedback inserted successfully");
          }
        } catch (eventFeedbackErr: any) {
          console.error("Event feedback insertion failed:", eventFeedbackErr);
          if (eventFeedbackErr.message.includes('relation "public.event_feedback" does not exist')) {
            toast.warning("Feedback submitted successfully. Event linking will be available after database migration.");
          } else {
            toast.warning("Feedback submitted, but event linking failed.");
          }
        }
      }

      toast.success("Thank you! Your feedback has been submitted.");
      setIsSubmitted(true);
    } catch (err: any) {
      console.error("Feedback error:", err);
      console.error("Error details:", {
        message: err.message,
        details: err.details,
        hint: err.hint,
        code: err.code
      });
      
      // Show more detailed error message to user
      let errorMessage = "Failed to submit feedback.";
      if (err.message) {
        errorMessage = err.message;
      } else if (err.code) {
        errorMessage = `Error ${err.code}: ${err.message || 'Failed to submit feedback'}`;
      }
      
      toast.error(errorMessage, {
        description: err.hint || err.details || "Please check your connection and try again.",
        duration: 5000,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    !mounted ? (
      <div className="w-full max-w-2xl mx-auto py-12 pr-3">
        <h1 className="text-3xl font-bold mb-6">Send Feedback</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    ) : isSubmitted ? (
      <div className="w-full max-w-2xl mx-auto py-12 pr-3">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold mb-4 text-green-600">Feedback Submitted</h1>
          <p className="text-lg text-muted-foreground mb-8">
            Thank you for your support! We appreciate your feedback and will review it soon.
          </p>
          <Button onClick={resetForm} className="bg-green-600 hover:bg-green-700 text-white">
            Submit Another Feedback
          </Button>
        </div>
      </div>
    ) : (
    <div className="w-full max-w-2xl mx-auto py-12 pr-3">
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
              <option value="bug_report">Bug Report</option>
              <option value="feature_request">Feature Request</option>
              <option value="general">General</option>
              <option value="event_feedback">Event Feedback</option>
              <option value="user_experience">User Experience</option>
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
              <option value="medium">Medium</option>
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

        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.push("/")} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </div>
      </form>
    </div>
    )
  );
}


