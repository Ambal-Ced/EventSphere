"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export function Footer() {
  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-primary"></div>
              <span className="text-lg font-semibold">EventTria</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your comprehensive event management platform for creating, managing, and promoting events of all sizes.
            </p>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/policy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Policy & Terms
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-8 pt-8 border-t">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">
              © 2024 EventTria. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Made with ❤️ for event organizers</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
