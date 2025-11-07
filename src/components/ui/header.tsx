"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User as AuthUser } from "@supabase/supabase-js"; // Supabase User type
import { cn } from "@/lib/utils";
import { Bell, MessageSquare, Loader2, Menu, X, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

// Use shared singleton client from lib

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [showRatingTooltip, setShowRatingTooltip] = useState(false);
  const unreadCount = notifs.filter((n) => !n.read_at).length;

  useEffect(() => {
    const getSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUser(session?.user ?? null);

      if (session?.user) {
        // Fetch profile data including avatar_url
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .single();

        setProfile(profileData);
      }
      setIsLoading(false);
    };

    getSession();

    // Set up real-time subscription for profile changes
    const profileSubscription = supabase
      .channel("header-profile-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user?.id}`,
        },
        (payload) => {
          console.log("Profile updated in header:", payload);
          setProfile(payload.new);
        }
      )
      .subscribe();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          // Fetch profile data on auth state change
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .single();

          setProfile(profileData);
        } else {
          setProfile(null);
        }
        // Redirect to login if user logs out from another tab
        if (event === "SIGNED_OUT") {
          router.push("/login");
        }
      }
    );

    return () => {
      profileSubscription.unsubscribe();
      authListener?.subscription.unsubscribe();
    };
  }, [router, user?.id]);

  // Notifications: load latest and subscribe realtime
  useEffect(() => {
    if (!user) return;
    let channel: any;
    const load = async (limit = 5) => {
      try {
        setNotifLoading(true);
        const { data } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(limit);
        setNotifs(data || []);
      } finally {
        setNotifLoading(false);
      }
    };
    load();
    channel = supabase
      .channel('realtime-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        const n = payload.new as any;
        // RLS ensures user sees only own when fetching; client-side guard to be safe
        if (n.user_id === user.id) {
          setNotifs((prev) => [n, ...prev].slice(0, 5));
        }
      })
      .subscribe();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [user?.id]);

  // Listen for notification read events from notifications page
  useEffect(() => {
    const handleNotificationRead = (event: CustomEvent) => {
      const { id } = event.detail;
      setNotifs(prev => 
        prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n)
      );
    };

    const handleAllNotificationsRead = () => {
      setNotifs(prev => 
        prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() }))
      );
    };

    window.addEventListener('notificationRead', handleNotificationRead as EventListener);
    window.addEventListener('allNotificationsRead', handleAllNotificationsRead);

    return () => {
      window.removeEventListener('notificationRead', handleNotificationRead as EventListener);
      window.removeEventListener('allNotificationsRead', handleAllNotificationsRead);
    };
  }, []);

  // Rating tooltip logic: show every 1-2 hours and for new users
  useEffect(() => {
    if (!user || !profile) return;

    const checkShouldShowRatingTooltip = () => {
      const storageKey = `rating_tooltip_${user.id}`;
      const lastShown = localStorage.getItem(storageKey);
      const now = Date.now();
      
      // Check if user is newly registered (account created within last 7 days)
      const accountCreatedAt = profile.created_at ? new Date(profile.created_at).getTime() : null;
      const isNewUser = accountCreatedAt && (now - accountCreatedAt) < 7 * 24 * 60 * 60 * 1000; // 7 days
      
      // Always show for new users (first time)
      if (isNewUser && !lastShown) {
        return true;
      }
      
      // Show every 1-2 hours (randomized between 1-2 hours)
      if (lastShown) {
        const timeSinceLastShown = now - parseInt(lastShown);
        const hoursSinceLastShown = timeSinceLastShown / (1000 * 60 * 60);
        // Randomize between 1-2 hours to avoid showing at exact intervals
        const shouldShowInterval = hoursSinceLastShown >= 1 + Math.random(); // 1-2 hours
        return shouldShowInterval;
      }
      
      // Show on first visit
      return true;
    };

    // Check on mount and show if needed
    if (checkShouldShowRatingTooltip()) {
      setShowRatingTooltip(true);
      const storageKey = `rating_tooltip_${user.id}`;
      localStorage.setItem(storageKey, Date.now().toString());
    }

    // Set up interval to check every 30 minutes
    const interval = setInterval(() => {
      if (checkShouldShowRatingTooltip()) {
        setShowRatingTooltip(true);
        const storageKey = `rating_tooltip_${user.id}`;
        localStorage.setItem(storageKey, Date.now().toString());
      }
    }, 30 * 60 * 1000); // Check every 30 minutes

    return () => clearInterval(interval);
  }, [user, profile]);

  // Check if user is new (for always showing tooltip)
  const isNewUser = profile?.created_at && (Date.now() - new Date(profile.created_at).getTime()) < 7 * 24 * 60 * 60 * 1000;

  const expandNotifications = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifs(data || []);
  };

  const markRead = async (id: string) => {
    await supabase.rpc('mark_notification_read', { p_id: id });
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
  };

  const markAllRead = async () => {
    // Mark all unread as read for current user
    const nowIso = new Date().toISOString();
    await supabase
      .from('notifications')
      .update({ read_at: nowIso })
      .is('read_at', null);
    setNotifs((prev) => prev.map((n) => n.read_at ? n : { ...n, read_at: nowIso }));
  };

  // Function to get initials from first name
  const getInitials = (fname?: string | null) => {
    if (!fname) return "?";
    return fname.substring(0, 2).toUpperCase();
  };

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Logo and Main Navigation */}
      <div className="flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="relative h-8 w-8">
            <Image
              src="/images/template/eventtria.webp"
              alt="EventTria logo"
              fill
              className="object-contain rounded-full"
              sizes="(max-width: 768px) 32px, 32px"
              priority
            />
          </div>
          <span className="text-lg">EventTria</span>
        </Link>
      </div>

      {/* Center Navigation (desktop) */}
      <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:block">
        <div className="flex items-center gap-8">
          <Link prefetch={true}
            href="/"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Home
          </Link>
          <Link prefetch={true}
            href="/events"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/events" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Events
          </Link>
          <Link prefetch={true}
            href="/about"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/about" ? "text-primary" : "text-muted-foreground"
            )}
          >
            About
          </Link>
          <Link prefetch={true}
            href="/faqs"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/faqs" ? "text-primary" : "text-muted-foreground"
            )}
          >
            FAQs
          </Link>
          <Link prefetch={true}
            href="/pricing"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/pricing" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Pricing
          </Link>
        </div>
      </nav>

      {/* Mobile menu trigger moved to right side near profile */}

      {/* Right side: Icons and User Menu/Login */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
        ) : user ? (
          <>
            {/* Rating Star Icon */}
            <div className="relative group hidden md:block">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted/50 transition-colors"
                aria-label="Rate us"
                onClick={() => {
                  router.push("/rating");
                  setShowRatingTooltip(false);
                  if (user) {
                    const storageKey = `rating_tooltip_${user.id}`;
                    localStorage.setItem(storageKey, Date.now().toString());
                  }
                }}
              >
                <Star className="h-5 w-5" />
              </Button>

              {/* Rating Tooltip - shows on hover, or always visible for new users when showRatingTooltip is true */}
              {showRatingTooltip && (
                <div className={`absolute right-0 top-full mt-2 transition-opacity duration-200 z-50 ${
                  isNewUser ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                } ${!isNewUser ? 'pointer-events-none' : ''}`}>
                  <div className={`bg-slate-900 text-white rounded-lg p-4 shadow-lg border border-slate-700 min-w-[250px] max-w-[300px] relative ${isNewUser ? '' : 'pointer-events-auto'}`}>
                    {/* Close button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowRatingTooltip(false);
                        if (user) {
                          const storageKey = `rating_tooltip_${user.id}`;
                          localStorage.setItem(storageKey, Date.now().toString());
                        }
                      }}
                      className="absolute top-2 right-2 text-slate-400 hover:text-white transition-colors"
                      aria-label="Close"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-start gap-3 mb-2 pr-6">
                      <Star className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">
                          EventTria - Please Rate Us
                        </p>
                        <p className="text-xs text-slate-300 leading-relaxed">
                          Let us know what we can do to improve our website. Your feedback helps us serve you better!
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/rating");
                          setShowRatingTooltip(false);
                          if (user) {
                            const storageKey = `rating_tooltip_${user.id}`;
                            localStorage.setItem(storageKey, Date.now().toString());
                          }
                        }}
                      >
                        Rate Now
                      </Button>
                    </div>
                  </div>
                  {/* Arrow pointing up */}
                  <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
                </div>
              )}
            </div>

            <Popover open={notifOpen} onOpenChange={setNotifOpen}>
              <PopoverTrigger asChild>
                {/* Desktop icon (PopoverTrigger requires a single child) */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative rounded-full hidden md:inline-flex"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
                      {Math.min(unreadCount, 99)}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="p-3 border-b">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Notifications</div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={markAllRead}>Mark all read</Button>
                      <Button variant="outline" size="sm" onClick={expandNotifications}>Expand</Button>
                    </div>
                  </div>
                </div>
                <div className="max-h-80 overflow-auto">
                  {notifLoading ? (
                    <div className="flex items-center gap-2 p-3 text-slate-400 text-sm"><Loader2 className="w-4 h-4 animate-spin"/> Loading…</div>
                  ) : notifs.length === 0 ? (
                    <div className="p-3 text-slate-400 text-sm">No notifications</div>
                  ) : (
                    notifs.map((n) => (
                      <button
                        key={n.id}
                        className={`w-full text-left p-3 border-b hover:bg-muted/40 ${!n.read_at ? 'bg-muted/20' : ''}`}
                        onClick={async () => {
                          await markRead(n.id);
                          if (n.link_url) router.push(n.link_url);
                        }}
                      >
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-slate-400 line-clamp-2">{n.message}</div>
                      </button>
                    ))
                  )}
                </div>
                <div className="p-2">
                  <Button asChild variant="ghost" className="w-full">
                    <Link prefetch={true} href="/notifications">View all notifications</Link>
                  </Button>
                </div>
              </PopoverContent>
            </Popover>


            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted/50 transition-colors"
                asChild
              >
                <Link prefetch={true} href="/profile">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={profile?.avatar_url}
                      className="object-cover"
                    />
                    <AvatarFallback>
                      {getInitials(profile?.fname)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="sr-only">Profile</span>
                </Link>
              </Button>

              {/* Hover Tooltip */}
              <div className="absolute right-0 top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                <div className="bg-slate-900 text-white rounded-lg p-3 shadow-lg border border-slate-700 min-w-[200px]">
                  <div className="flex items-center gap-3 mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage
                        src={profile?.avatar_url}
                        className="object-cover"
                      />
                      <AvatarFallback>
                        {getInitials(profile?.fname)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">
                        {profile?.fname} {profile?.lname}
                      </p>
                      <p className="text-xs text-slate-300">{user?.email}</p>
                    </div>
                  </div>
                  <div className="text-xs text-slate-300 text-center">
                    Click to view profile
                  </div>
                </div>

                {/* Arrow pointing up */}
                <div className="absolute -top-1 right-4 w-2 h-2 bg-slate-900 border-l border-t border-slate-700 transform rotate-45"></div>
              </div>
            </div>

            {/* Mobile menu trigger next to profile */}
            <button
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted/50"
              aria-label="Open menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </>
        ) : (
          <>
            {/* Desktop buttons */}
            <div className="hidden sm:flex items-center gap-2">
              <Button asChild size="sm">
                <Link prefetch={true} href="/login">Log In</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link prefetch={true} href="/register">Sign Up</Link>
              </Button>
            </div>
            
            {/* Mobile hamburger menu for non-authenticated users */}
            <button
              className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-md hover:bg-muted/50"
              aria-label="Open menu"
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </>
        )}
      </div>
      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 border-b bg-background px-4 py-3 z-50">
          <div className="flex flex-col gap-3 items-center text-center">
            <Link prefetch={true} href="/" className={cn("text-base", pathname === "/" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>Home</Link>
            <Link prefetch={true} href="/events" className={cn("text-base", pathname === "/events" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>Events</Link>
            <Link prefetch={true} href="/about" className={cn("text-base", pathname === "/about" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>About</Link>
            <Link prefetch={true} href="/faqs" className={cn("text-base", pathname === "/faqs" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>FAQs</Link>
            <Link prefetch={true} href="/pricing" className={cn("text-base", pathname === "/pricing" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>Pricing</Link>
            
            {/* Show notifications only for authenticated users */}
            {user && (
              <>
                <Link prefetch={true} href="/notifications" className="flex items-center justify-center gap-2 text-base" onClick={()=>setMobileOpen(false)}>
                  <span className={cn(pathname === "/notifications" ? "text-primary" : "text-muted-foreground")}>Notifications</span>
                  {unreadCount > 0 && (
                    <span className="min-w-[18px] h-5 px-1 rounded-full bg-primary text-[11px] font-medium text-primary-foreground inline-flex items-center justify-center">
                      {Math.min(unreadCount, 99)}
                    </span>
                  )}
                </Link>
                <Link prefetch={true} href="/rating" className={cn("text-base", pathname === "/rating" ? "text-primary" : "text-muted-foreground")} onClick={()=>setMobileOpen(false)}>
                  Rate Us Now
                </Link>
              </>
            )}
            
            {/* Show login/signup buttons for non-authenticated users */}
            {!user && (
              <>
                <div className="w-full border-t my-2"></div>
                <Button asChild className="w-full" onClick={()=>setMobileOpen(false)}>
                  <Link prefetch={true} href="/login">Log In</Link>
                </Button>
                <Button asChild variant="outline" className="w-full" onClick={()=>setMobileOpen(false)}>
                  <Link prefetch={true} href="/register">Sign Up</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
