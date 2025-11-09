import { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Generate static params for public events
export async function generateStaticParams() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Fetch public events that are not cancelled
    const { data: events, error } = await supabase
      .from("events")
      .select("id")
      .eq("is_public", true)
      .neq("status", "cancelled")
      .limit(100); // Limit to first 100 public events for build time
    
    if (error) {
      console.error("Error fetching events for static generation:", error);
      return [];
    }
    
    return (events || []).map((event) => ({
      eventId: event.id,
    }));
  } catch (error) {
    console.error("Error in generateStaticParams:", error);
    return [];
  }
}

// Generate metadata for each event page
export async function generateMetadata({
  params,
}: {
  params: Promise<{ eventId: string }>;
}): Promise<Metadata> {
  try {
    const supabase = createServerSupabaseClient();
    const { eventId } = await params; // Await params in Next.js 15
    const { data: event, error } = await supabase
      .from("events")
      .select("id, title, description, image_url, date, location")
      .eq("id", eventId)
      .single();

    if (error || !event) {
      return {
        title: "Event - EventTria",
        description: "View event details on EventTria",
        openGraph: {
          title: "Event - EventTria",
          description: "View event details on EventTria",
          images: ["/images/template/eventtria.webp"],
        },
      };
    }

    const eventImage = event.image_url || "/images/template/eventtria.webp";
    const eventDate = event.date ? new Date(event.date).toLocaleDateString() : "";

    return {
      title: `${event.title} - EventTria`,
      description: event.description || `Join us for ${event.title} on ${eventDate} at ${event.location || "TBA"}`,
      openGraph: {
        title: event.title,
        description: event.description || `Join us for ${event.title} on ${eventDate} at ${event.location || "TBA"}`,
        images: [
          {
            url: eventImage,
            width: 1200,
            height: 630,
            alt: event.title,
          },
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: event.title,
        description: event.description || `Join us for ${event.title} on ${eventDate} at ${event.location || "TBA"}`,
        images: [eventImage],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Event - EventTria",
      description: "View event details on EventTria",
      openGraph: {
        title: "Event - EventTria",
        description: "View event details on EventTria",
        images: ["/images/template/eventtria.webp"],
      },
    };
  }
}

// Enable ISR (Incremental Static Regeneration) - revalidate every hour
export const revalidate = 3600; // 1 hour

// Enable dynamic params for events not pre-rendered
export const dynamicParams = true;

export default function EventLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

