"use client";

import React, { useMemo, useCallback, memo, Suspense, lazy, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  User as UserIcon,
  CalendarCheck2,
  Settings,
  LogOut,
  MessageSquare,
  BarChart2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";

// Memoized sidebar links configuration
const sidebarLinksConfig = [
  {
    title: "Profile",
    href: "/profile",
    icon: UserIcon,
    authRequired: true,
  },
  {
    title: "My Events",
    href: "/my-events",
    icon: CalendarCheck2,
    authRequired: true,
  },
  {
    title: "Analytics",
    href: "/analytics",
    icon: BarChart2,
    authRequired: true,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    authRequired: true,
  },
  {
    title: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    authRequired: false,
  },
] as const;

// Memoized loading skeleton component
const SidebarSkeleton = memo(() => (
  <div className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r bg-background p-4">
    <div className="space-y-2">
      {sidebarLinksConfig.map((_, index) => (
        <div
          key={index}
          className="flex items-center space-x-3 rounded-lg px-3 py-2"
        >
          <div className="h-5 w-5 rounded bg-muted animate-pulse" />
          <div className="h-4 flex-1 rounded bg-muted animate-pulse" />
        </div>
      ))}
    </div>
  </div>
));

SidebarSkeleton.displayName = "SidebarSkeleton";

// Memoized sidebar link component
const SidebarLink = memo(
  ({
    link,
    isActive,
    isDisabled,
    onClick,
    showLabel,
  }: {
    link: (typeof sidebarLinksConfig)[number];
    isActive: boolean;
    isDisabled: boolean;
    onClick: (e: React.MouseEvent) => void;
    showLabel: boolean;
  }) => {
    const Icon = link.icon;

    return (
      <Link
        href={link.href}
        onClick={onClick}
        className={cn(
          "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          isDisabled && "cursor-not-allowed opacity-50 pointer-events-none",
          showLabel ? "space-x-3 justify-start" : "justify-center"
        )}
        aria-disabled={isDisabled}
      >
        <Icon className={cn(showLabel ? "h-5 w-5" : "h-4 w-4")} />
        {showLabel && <span>{link.title}</span>}
      </Link>
    );
  }
);

SidebarLink.displayName = "SidebarLink";

// Lazy-loaded sidebar content component
const SidebarContent = lazy(() =>
  Promise.resolve({
    default: memo(({ isOpen }: { isOpen: boolean }) => {
      const pathname = usePathname();
      const router = useRouter();
      const { user, loading, signOut } = useAuth();

      const isAuthenticated = useMemo(() => !!user, [user]);
      const activePath = useMemo(() => pathname, [pathname]);
      const isAllDisabled = useMemo(() => !isAuthenticated, [isAuthenticated]);

      const handleLogout = useCallback(async () => {
        try {
          await signOut();
          // Force refresh to homepage after logout
          window.location.href = "/";
        } catch (err) {
          console.error("Logout failed:", err);
          // Still redirect even if logout fails
          window.location.href = "/";
        }
      }, [signOut]);

      const handleLinkClick = useCallback(
        (e: React.MouseEvent, isDisabled: boolean) => {
          if (isDisabled) {
            e.preventDefault();
          }
        },
        []
      );

      const sidebarLinks = useMemo(
        () =>
          sidebarLinksConfig.map((link) => {
            const isActive = activePath === link.href;
            const isDisabled =
              isAllDisabled || (link.authRequired && !isAuthenticated);

            return (
              <SidebarLink
                key={link.href}
                link={link}
                isActive={isActive}
                isDisabled={isDisabled}
                onClick={(e) => handleLinkClick(e, isDisabled)}
                showLabel={isOpen}
              />
            );
          }),
        [activePath, isAllDisabled, isAuthenticated, handleLinkClick, isOpen]
      );

      const logoutButton = useMemo(() => {
        if (!isAuthenticated) return null;

        return (
          <div className={cn("mt-auto border-t p-4", !isOpen && "hidden") }>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start gap-2 px-3 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
            >
              <LogOut className="h-5 w-5" />
              <span>Log Out</span>
            </Button>
          </div>
        );
      }, [isAuthenticated, handleLogout, isOpen]);

      if (loading) {
        return <SidebarSkeleton />;
      }

      return (
        <div className="flex h-full flex-col">
          <nav className="flex-1 space-y-2 p-4">{sidebarLinks}</nav>
          {logoutButton}
        </div>
      );
    }),
  })
);

// Main sidebar component with lazy loading
export const Sidebar = memo(() => {
  const [open, setOpen] = useState(false);

  // Collapse by default on small screens
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    setOpen(!mq.matches ? true : false);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    if (mq.matches) setOpen(false); // always collapsed on small screens
  }, []);

  return (
    <>
      <div
        className={cn(
          "sticky top-16 h-[calc(100vh-4rem)] border-r bg-background transition-all",
          open ? "w-64" : "w-16"
        )}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarContent isOpen={open} />
        </Suspense>
      </div>
    </>
  );
});

Sidebar.displayName = "Sidebar";
