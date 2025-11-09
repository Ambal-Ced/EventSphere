import { Metadata } from "next";

// Enable ISR - revalidate events page every 15 minutes (events list changes frequently)
export const revalidate = 900; // 15 minutes

export const metadata: Metadata = {
  title: "Browse Events - EventTria",
  description: "Find and join upcoming events on EventTria. Discover events by category, date, and location.",
  openGraph: {
    title: "Browse Events - EventTria",
    description: "Find and join upcoming events on EventTria. Discover events by category, date, and location.",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria - Browse Events",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Browse Events - EventTria",
    description: "Find and join upcoming events on EventTria. Discover events by category, date, and location.",
    images: ["/images/template/eventtria.webp"],
  },
};

export default function EventsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

