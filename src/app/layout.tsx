import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";
import { Header } from "@/components/ui/header";
import { Sidebar } from "@/components/ui/sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EventSphere",
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
      <body className={`${inter.className} overflow-hidden`}>
        <AuthProvider>
          <div className="flex h-screen flex-col">
            <Header />
            <div className="flex flex-1 overflow-hidden">
              {/* sidebar column is fixed width; content column flexes */}
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-0">
                {/* Responsive container to keep margins equal after excluding sidebar width */}
                {/* Base (>=768px and <1024px): sidebar ~10% → content ~90% → target inner = 80% + 5% margins */}
                {/* Large (>=1024px): sidebar expanded ~25% → content ~75% → target inner = 65% + 5% margins */}
                {/* Small (<768px): sidebar overlays (0%), keep 90% inner with 5% margins */}
                {/* Margins measured from the sidebar's right border: 5% on both sides */}
                {/* Sidebar ~10% (collapsed) at sm/md → content 90%; lg expanded ~25% → adjust container but keep 5% gutters */}
                <div className="ml-[5%] mr-[5%] max-[639px]:ml-[10%] max-[639px]:mr-[2%] sm:ml-[13%] sm:mr-[5%] md:ml-[10%] md:mr-[0%] lg:ml-[5%] lg:mr-[5%]">
                  <div className="w-full">
                    {children}
                  </div>
                </div>
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
