"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { User as AuthUser } from "@supabase/supabase-js"; // Supabase User type
import { cn } from "@/lib/utils";
import { Bell, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// Use shared singleton client from lib

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

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

  // Function to get initials from first name
  const getInitials = (fname?: string | null) => {
    if (!fname) return "?";
    return fname.substring(0, 2).toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      {/* Logo and Main Navigation */}
      <div className="flex-shrink-0">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <div className="relative h-8 w-8">
            <Image
              src="/images/template/eventsphere.jpg"
              alt="EventSphere logo"
              fill
              className="object-contain rounded-full"
              sizes="(max-width: 768px) 32px, 32px"
              priority
            />
          </div>
          <span className="text-lg">EventSphere</span>
        </Link>
      </div>

      {/* Center Navigation */}
      <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Home
          </Link>
          <Link
            href="/events"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/events" ? "text-primary" : "text-muted-foreground"
            )}
          >
            Events
          </Link>
          <Link
            href="/about"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/about" ? "text-primary" : "text-muted-foreground"
            )}
          >
            About
          </Link>
          <Link
            href="/faqs"
            className={cn(
              "text-lg font-medium transition-colors hover:text-primary",
              pathname === "/faqs" ? "text-primary" : "text-muted-foreground"
            )}
          >
            FAQs
          </Link>
        </div>
      </nav>

      {/* Right side: Icons and User Menu/Login */}
      <div className="flex items-center gap-4">
        {isLoading ? (
          <div className="h-8 w-8 animate-pulse rounded-full bg-muted"></div>
        ) : user ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              className="relative rounded-full"
            >
              <Bell className="h-5 w-5" />
              <span className="sr-only">Notifications</span>
              {/* Optional: Add notification badge */}
              <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                2
              </span>
            </Button>


            <div className="relative group">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full hover:bg-muted/50 transition-colors"
                asChild
              >
                <Link href="/profile">
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
          </>
        ) : (
          <>
            <Button asChild size="sm">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/register">Sign Up</Link>
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
