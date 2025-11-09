import { Metadata } from "next";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// Generate static params for active checkin portals
export async function generateStaticParams() {
  try {
    const supabase = createServerSupabaseClient();
    
    // Fetch active checkin portals (limit to most recent 50 for build time)
    const { data: portals, error } = await supabase
      .from("attendance_portals")
      .select("token")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) {
      console.error("Error fetching checkin portals for static generation:", error);
      return [];
    }
    
    return (portals || []).map((portal) => ({
      token: encodeURIComponent(portal.token),
    }));
  } catch (error) {
    console.error("Error in generateStaticParams for checkin:", error);
    return [];
  }
}

// Generate metadata for checkin pages
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  try {
    const supabase = createServerSupabaseClient();
    const { token } = await params; // Await params in Next.js 15
    const decodedToken = decodeURIComponent(token);
    
    const { data: portal, error } = await supabase
      .from("attendance_portals")
      .select("event_id, events(title, image_url)")
      .eq("token", decodedToken)
      .eq("is_active", true)
      .single();

    if (error || !portal) {
      return {
        title: "Event Check-in - EventTria",
        description: "Check in to your event on EventTria",
        openGraph: {
          title: "Event Check-in - EventTria",
          description: "Check in to your event on EventTria",
          images: ["/images/template/eventtria.webp"],
        },
      };
    }

    const event = portal.events as any;
    const eventImage = event?.image_url || "/images/template/eventtria.webp";

    return {
      title: `Check-in - ${event?.title || "Event"} - EventTria`,
      description: `Check in to ${event?.title || "this event"} on EventTria`,
      openGraph: {
        title: `Check-in - ${event?.title || "Event"} - EventTria`,
        description: `Check in to ${event?.title || "this event"} on EventTria`,
        images: [eventImage],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: `Check-in - ${event?.title || "Event"} - EventTria`,
        description: `Check in to ${event?.title || "this event"} on EventTria`,
        images: [eventImage],
      },
    };
  } catch (error) {
    console.error("Error generating metadata:", error);
    return {
      title: "Event Check-in - EventTria",
      description: "Check in to your event on EventTria",
      openGraph: {
        title: "Event Check-in - EventTria",
        description: "Check in to your event on EventTria",
        images: ["/images/template/eventtria.webp"],
      },
    };
  }
}

// Enable dynamic params for tokens not pre-rendered
export const dynamicParams = true;

// Revalidate every 30 minutes for active portals
export const revalidate = 1800; // 30 minutes

export default function CheckinLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

