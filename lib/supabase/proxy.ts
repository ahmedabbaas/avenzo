import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const publicPath =
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/about" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname === "/community-guidelines" ||
    pathname === "/api/health" ||
    pathname === "/auth" ||
    pathname === "/auth/confirm" ||
    pathname.startsWith("/api/auth/");

  const guestOnly =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password";

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if ((!user || !user.email_confirmed_at) && !publicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = user ? "error=verify" : "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user?.email_confirmed_at && guestOnly) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return response;
}
