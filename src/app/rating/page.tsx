"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function RatingPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [suggestion, setSuggestion] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  // Fetch existing rating on mount
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchRating = async () => {
      try {
        const { data, error } = await supabase
          .from("user_ratings")
          .select("rating, suggestion")
          .eq("user_id", user.id)
          .maybeSingle();

        if (error && error.code !== "PGRST116") {
          console.error("Error fetching rating:", error);
        } else if (data) {
          setRating(data.rating || 0);
          setSuggestion(data.suggestion || "");
          setSubmitted(true);
        }
      } catch (error) {
        console.error("Error fetching rating:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRating();
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSubmitting(true);
    try {
      // Check if rating already exists
      const { data: existing } = await supabase
        .from("user_ratings")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const payload = {
        user_id: user.id,
        rating: rating,
        suggestion: suggestion.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing rating
        const { error } = await supabase
          .from("user_ratings")
          .update(payload)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Insert new rating
        const { error } = await supabase
          .from("user_ratings")
          .insert({
            ...payload,
            created_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      setSubmitted(true);
    } catch (error: any) {
      console.error("Error submitting rating:", error);
      alert("Failed to submit rating. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-muted-foreground">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="rounded-lg border p-6 sm:p-8 bg-card">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Rate EventTria</h1>
          <p className="text-muted-foreground mb-6">
            {submitted 
              ? "Thank you for your rating! You can update it anytime."
              : "Your feedback helps us improve our platform. Please rate your experience."}
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Star Rating */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Rating {rating > 0 && `(${rating} ${rating === 1 ? 'star' : 'stars'})`}
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoveredRating(star)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-110"
                    aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
                  >
                    <Star
                      className={`h-10 w-10 sm:h-12 sm:w-12 transition-colors ${
                        star <= (hoveredRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Click on a star to rate. You can submit without selecting a rating.
              </p>
            </div>

            {/* Suggestion Box */}
            <div>
              <label htmlFor="suggestion" className="text-sm font-medium mb-2 block">
                Suggestions (Optional)
              </label>
              <textarea
                id="suggestion"
                value={suggestion}
                onChange={(e) => {
                  if (e.target.value.length <= 1500) {
                    setSuggestion(e.target.value);
                  }
                }}
                placeholder="Tell us what we can do to improve..."
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                maxLength={1500}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  {suggestion.length} / 1500 characters
                </p>
                {suggestion.length >= 1500 && (
                  <p className="text-xs text-destructive">Character limit reached</p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <span className="mr-2">Submitting...</span>
                </>
              ) : submitted ? (
                "Update Rating"
              ) : (
                "Submit Rating"
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
