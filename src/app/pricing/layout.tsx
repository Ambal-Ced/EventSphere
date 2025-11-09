import { Metadata } from "next";

// Enable ISR - revalidate pricing page every 6 hours (pricing may change)
export const revalidate = 21600; // 6 hours

export const metadata: Metadata = {
  title: "Pricing - EventTria",
  description: "Choose the perfect plan for your event management needs. Free tier available with premium features.",
  openGraph: {
    title: "Pricing - EventTria",
    description: "Choose the perfect plan for your event management needs. Free tier available with premium features.",
    images: [
      {
        url: "/images/template/eventtria.webp",
        width: 1200,
        height: 630,
        alt: "EventTria - Pricing",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing - EventTria",
    description: "Choose the perfect plan for your event management needs. Free tier available with premium features.",
    images: ["/images/template/eventtria.webp"],
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

