import { Metadata } from "next";

// Force static generation - this page doesn't change often
export const dynamic = 'force-static';
export const revalidate = false; // Never revalidate, fully static

export const metadata: Metadata = {
  title: "About EventTria - Our Mission, Story & Team",
  description: "Learn more about EventTria's mission, story, values, team, and how to contact us.",
  openGraph: {
    title: "About EventTria - Our Mission, Story & Team",
    description: "Learn more about EventTria's mission, story, values, team, and how to contact us.",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria - About Us",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About EventTria - Our Mission, Story & Team",
    description: "Learn more about EventTria's mission, story, values, team, and how to contact us.",
    images: ["/images/template/eventtria.webp"],
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

