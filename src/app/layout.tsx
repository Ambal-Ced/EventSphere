import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { Header } from "@/components/ui/header";
import { Sidebar } from "@/components/ui/sidebar";
import { Footer } from "@/components/ui/footer";
// Revert to simple layout without conditional wrapper

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EventTria",
  description: "Your event management platform",
};

// Pages that don't need the sidebar
const noSidebarPages = ["/login", "/register", "/", "/about", "/faqs"];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen flex flex-col`}>
        <AuthProvider>
          <div className="flex flex-col min-h-screen">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar enabled; reserves its own lane on >=768px and overlays on mobile */}
              <Sidebar />
              {/* Fixed gutter reserved (kept for consistent layout) */}
              <div className="w-3 shrink-0" aria-hidden />
              <main className="flex-1 overflow-y-auto p-0 flex flex-col">
                {/* Minimal, symmetric horizontal padding so pages are near full-width.
                    Sidebar controls overall left offset; we avoid extra margins here. */}
                {/* Fixed right gutter to mirror the left spacer */}
                <div className="pr-3 flex-1">
                  {children}
                </div>
                <Footer />
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
