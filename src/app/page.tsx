import { Metadata } from "next";
import { Suspense } from "react";
import HomeClient from "./home-client";
import { Loader2 } from "lucide-react";

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
      {/* Hero Section - Static */}
      <section className="container mx-auto px-4 py-12 md:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            Create and Manage Your Events
          </h1>
          <p className="text-xl text-muted-foreground mb-8">
            Plan events end-to-end: create events, add items and scripts, assign tasks, and track progress.
          </p>
        </div>

        {/* Features Grid - Static */}
        <div className="grid md:grid-cols-3 gap-6 mb-16">
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Easy Event Creation</h3>
            <p className="text-muted-foreground">
              Create events quickly with our intuitive interface. Add details, set dates, and manage everything in one place.
            </p>
          </div>
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Smart Management</h3>
            <p className="text-muted-foreground">
              Organize items, scripts, and tasks efficiently. Track progress and collaborate with your team seamlessly.
            </p>
          </div>
          <div className="bg-card rounded-lg p-6 border">
            <h3 className="text-xl font-semibold mb-3">Powerful Analytics</h3>
            <p className="text-muted-foreground">
              Get insights into your events with AI-powered analytics. Make data-driven decisions to improve your events.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

// Loading component for dynamic sections
function HomeDynamicLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Loading events...</p>
      </div>
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
