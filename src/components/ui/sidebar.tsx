"use client";

import React, { useMemo, useCallback, memo, useState, useEffect } from "react";
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
  CreditCard,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { supabase } from "@/lib/supabase";

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
    title: "Billing",
    href: "/billing",
    icon: CreditCard,
    authRequired: true,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    authRequired: true,
  },
  // Admin link (filtered at render-time for admin users only)
  {
    title: "Admin",
    href: "/admin",
    icon: Shield,
    authRequired: true,
    adminOnly: true as const,
  },
  {
    title: "Feedback",
    href: "/feedback",
    icon: MessageSquare,
    authRequired: false,
  },
] as const;

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
          "flex w-full items-center rounded-lg text-sm font-medium transition-colors",
          // Keep overall row height stable
          "py-1.5",
          // Expanded: full row highlight
          showLabel ? (isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted") : "",
          // Balanced padding in expanded; in collapsed center the tile with no horizontal padding
          showLabel ? "pl-3 pr-4" : "px-0",
          isDisabled && "cursor-not-allowed opacity-50 pointer-events-none"
        )}
        aria-disabled={isDisabled}
      >
          <div
          className={cn(
            "flex items-center justify-center flex-shrink-0 h-10 w-10 rounded-md",
            // Tile background only in collapsed; in expanded, row background handles active state
            !showLabel && (isActive ? "bg-primary text-primary-foreground" : ""),
            // Position tweaks: keep a small left offset so it never touches the inner border line
            // Expanded: small left margin; Collapsed: perfectly centered tile
            showLabel ? "ml-1 mr-3" : "mx-auto"
          )}
      >
        <Icon className="h-5 w-5" />
        </div>
        {showLabel && <span className="truncate">{link.title}</span>}
      </Link>
    );
  }
);

SidebarLink.displayName = "SidebarLink";

// Static sidebar content component (no lazy loading)
const SidebarContent = memo(({ isOpen }: { isOpen: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  const isAuthenticated = useMemo(() => !!user, [user]);
  const activePath = useMemo(() => pathname, [pathname]);
  const isAllDisabled = useMemo(() => !isAuthenticated, [isAuthenticated]);

  // Load account_type to determine admin
  useEffect(() => {
    let cancelled = false;
    const loadRole = async () => {
      try {
        if (!user?.id) {
          if (!cancelled) setIsAdmin(false);
          return;
        }
        const { data, error } = await supabase
          .from("profiles")
          .select("account_type")
          .eq("id", user.id)
          .single();
        if (!cancelled) {
          setIsAdmin((data?.account_type as string | undefined) === "admin");
        }
        if (error) {
          console.warn("Failed to load account_type for sidebar:", error);
        }
      } catch (err) {
        console.warn("Unexpected error loading account_type:", err);
      }
    };
    loadRole();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

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
      sidebarLinksConfig
        .filter((link: any) => !link.adminOnly || isAdmin)
        .map((link) => {
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
    [activePath, isAllDisabled, isAuthenticated, handleLinkClick, isOpen, isAdmin]
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

  return (
    <div className="flex h-full flex-col">
      <nav
        className={cn(
          "flex-1 p-3 md:p-4",
          isOpen ? "space-y-2" : "space-y-4 flex flex-col items-center"
        )}
      >
        {sidebarLinks}
      </nav>
      {logoutButton}
    </div>
  );
});

SidebarContent.displayName = "SidebarContent";

// Main sidebar component (optimized for speed)
export const Sidebar = memo(() => {
  const [open, setOpen] = useState(false); // Closed by default
  const [isTouch, setIsTouch] = useState(false);

  // Detect touch / non-hover devices to switch to click-to-toggle behavior
  useEffect(() => {
    const hoverNone = window.matchMedia('(hover: none)');
    const update = () => setIsTouch(hoverNone.matches);
    update();
    hoverNone.addEventListener('change', update);
    return () => hoverNone.removeEventListener('change', update);
  }, []);

  return (
    <>
      <div
        className={cn(
          // Reserve lane at all sizes (no overlay). Width changes only from 16 to 64.
          open
            ? "sticky top-16 h-[calc(100vh-4rem)] w-64"
            : "sticky top-16 h-[calc(100vh-4rem)] w-16",
          "border-r bg-background transition-all"
        )}
        onMouseEnter={isTouch ? undefined : () => setOpen(true)}
        onMouseLeave={isTouch ? undefined : () => setOpen(false)}
        onClick={isTouch ? () => setOpen((v) => !v) : undefined}
      >
        <SidebarContent isOpen={open} />
      </div>
    </>
  );
});

Sidebar.displayName = "Sidebar";
