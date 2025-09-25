import { Metadata } from "next";
import HomeClient from "./home-client"; // Import the client component

// Export metadata from the Server Component
export const metadata: Metadata = {
  title: "EventSphere - Create and Manage Your Events",
  description:
    "Plan events end-to-end: create events, add items and scripts, assign tasks, and track progress.",
};

// Default export (Server Component)
export default function Page() {
  // Render the Client Component
  return <HomeClient />;
}
