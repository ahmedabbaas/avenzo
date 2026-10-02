"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import MobileBottomNav from "./mobile-bottom-nav";
import { createClient } from "../lib/supabase/client";
import { avatarFor } from "../features/social/lib/profile";
import type { Profile } from "../features/social/types";

const NAV_ROUTES = [
  "/messages",
  "/reels",
  "/u/",
  "/p/",
  "/connections/",
  "/channels",
  "/mobile/profile-posts/",
];

export default function AppRouteMobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [avatarUrl, setAvatarUrl] = useState("");

  const visible = NAV_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route)
  );

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void supabase.auth.getUser().then(async ({ data }) => {
        if (!data.user || cancelled) return;

        const profileResult = await supabase
          .from("profiles")
          .select("id,username,display_name,bio,avatar_url,verified")
          .eq("id", data.user.id)
          .maybeSingle();

        if (cancelled || !profileResult.data) return;

        setAvatarUrl(avatarFor(profileResult.data as Profile));
      });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [supabase, visible]);

  if (!visible) return null;

  return (
    <MobileBottomNav
      active={
        pathname.startsWith("/reels")
          ? "reels"
          : pathname.startsWith("/home")
            ? "home"
            : null
      }
      onHome={() => router.push("/home")}
      onSearch={() => router.push("/home?screen=explore")}
      onCreate={() => router.push("/home?create=post")}
      onReels={() => router.push("/reels")}
      onProfile={() => router.push("/home?screen=profile")}
      profileAvatarUrl={avatarUrl}
    />
  );
}
