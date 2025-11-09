import { Metadata } from "next";

// Force static generation - FAQs don't change often
export const dynamic = 'force-static';
export const revalidate = false; // Never revalidate, fully static

export const metadata: Metadata = {
  title: "FAQs - EventTria",
  description: "Frequently asked questions about EventTria's platform and services.",
  openGraph: {
    title: "FAQs - EventTria",
    description: "Frequently asked questions about EventTria's platform and services.",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria - FAQs",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "FAQs - EventTria",
    description: "Frequently asked questions about EventTria's platform and services.",
    images: ["/images/template/eventtria.webp"],
  },
};

export default function FAQsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

