import { Metadata } from "next";
import { Suspense } from "react";
import HomeClient from "./home-client";
import { LoadingWithFallback } from "@/components/ui/loading-with-fallback";

// Export metadata from the Server Component
export const metadata: Metadata = {
  title: "EventTria - Create and Manage Your Events",
  description: "Plan events end-to-end: create events, add items and scripts, assign tasks, and track progress.",
  openGraph: {
    title: "EventTria - Create and Manage Your Events",
    description: "Plan events end-to-end: create events, add items and scripts, assign tasks, and track progress.",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria Logo",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "EventTria - Create and Manage Your Events",
    description: "Plan events end-to-end: create events, add items and scripts, assign tasks, and track progress.",
    images: ["/images/template/eventtria.webp"],
  },
};

// Enable ISR - revalidate home page every 30 minutes (featured events may change)
export const revalidate = 1800; // 30 minutes

// Static content that loads immediately
function HomeStaticContent() {
  return (
    <>
      {/* Static content removed - moved to HomeClient after hero image */}
    </>
  );
}

// Loading component for dynamic sections
function HomeDynamicLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <LoadingWithFallback message="Loading events..." />
    </div>
  );
}

// Default export (Server Component)
export default function Page() {
  return (
    <>
      {/* Static content loads immediately */}
      <HomeStaticContent />
      
      {/* Dynamic content with Suspense boundary */}
      <Suspense fallback={<HomeDynamicLoading />}>
        <HomeClient />
      </Suspense>
    </>
  );
}
