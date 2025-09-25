"use client";

import React, { useMemo, useCallback, memo, Suspense, lazy } from "react";
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
  }: {
    link: (typeof sidebarLinksConfig)[number];
    isActive: boolean;
    isDisabled: boolean;
    onClick: (e: React.MouseEvent) => void;
  }) => {
    const Icon = link.icon;

    return (
      <Link
        href={link.href}
        onClick={onClick}
        className={cn(
          "flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
          isDisabled && "cursor-not-allowed opacity-50 pointer-events-none"
        )}
        aria-disabled={isDisabled}
      >
        <Icon className="h-5 w-5" />
        <span>{link.title}</span>
      </Link>
    );
  }
);

SidebarLink.displayName = "SidebarLink";

// Lazy-loaded sidebar content component
const SidebarContent = lazy(() =>
  Promise.resolve({
    default: memo(() => {
      const pathname = usePathname();
      const router = useRouter();
      const { user, loading, signOut } = useAuth();

      const isAuthenticated = useMemo(() => !!user, [user]);
      const activePath = useMemo(() => pathname, [pathname]);
      const isAllDisabled = useMemo(() => !isAuthenticated, [isAuthenticated]);

      const handleLogout = useCallback(async () => {
        try {
          await signOut();
          router.push("/");
        } catch (err) {
          console.error("Logout failed:", err);
        }
      }, [signOut, router]);

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
              />
            );
          }),
        [activePath, isAllDisabled, isAuthenticated, handleLinkClick]
      );

      const logoutButton = useMemo(() => {
        if (!isAuthenticated) return null;

        return (
          <div className="mt-auto border-t p-4">
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
      }, [isAuthenticated, handleLogout]);

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
  return (
    <div className="sticky top-16 h-[calc(100vh-4rem)] w-64 border-r bg-background">
      <Suspense fallback={<SidebarSkeleton />}>
        <SidebarContent />
      </Suspense>
    </div>
  );
});

Sidebar.displayName = "Sidebar";
