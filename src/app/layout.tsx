import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Header } from "@/components/ui/header";
import { Sidebar } from "@/components/ui/sidebar";
import { Footer } from "@/components/ui/footer";
import { CompleteProfileHandler } from "@/components/ui/complete-profile-handler";
import { ThemeController } from "@/components/theme-controller";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
// Revert to simple layout without conditional wrapper

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://eventtria.com'),
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

// Pages that don't need the sidebar
const noSidebarPages = ["/login", "/register", "/", "/about", "/faqs"];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ThemeController />
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="flex flex-1 pt-16">
              {/* Sidebar enabled; reserves its own lane on >=768px and overlays on mobile */}
              <Sidebar />
              {/* Fixed gutter reserved (kept for consistent layout) */}
              <div className="w-3 shrink-0" aria-hidden />
              <main className="flex-1 flex flex-col overflow-x-hidden max-w-full">
                {/* Minimal, symmetric horizontal padding so pages are near full-width.
                    Sidebar controls overall left offset; we avoid extra margins here. */}
                {/* Fixed right gutter to mirror the left spacer */}
                <div className="pr-3 flex-1 overflow-x-hidden max-w-full w-full">
                  {children}
                </div>
                <Footer />
              </main>
            </div>
            {/* Complete Profile Popup Handler */}
            <CompleteProfileHandler />
          </div>
        </AuthProvider>
        <SpeedInsights />
      </body>
    </html>
  );
}
