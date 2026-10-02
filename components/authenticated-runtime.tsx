"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

const NativeMessageNotifications = dynamic(
  () => import("../features/notifications/components/native-message-notifications"),
  { ssr: false }
);
const CallManager = dynamic(
  () => import("../features/messages/components/call-manager"),
  { ssr: false }
);
const AppRouteMobileNav = dynamic(
  () => import("./app-route-mobile-nav"),
  { ssr: false }
);

const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/about",
  "/privacy",
  "/terms",
  "/community-guidelines",
  "/help",
];

export default function AuthenticatedRuntime() {
  const pathname = usePathname();
  const isPublic = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );

  if (isPublic) return null;

  return (
    <>
      <NativeMessageNotifications />
      <CallManager />
      <AppRouteMobileNav />
    </>
  );
}
