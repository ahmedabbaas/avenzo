import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestId =
    request.headers.get("x-request-id") || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
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

  let response = NextResponse.next({
    request: { headers: requestHeaders },
  });
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
        response = NextResponse.next({
          request: { headers: requestHeaders },
        });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  let requiresMfa = false;
  if (user?.email_confirmed_at) {
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    requiresMfa =
      aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  }

  if ((!user || !user.email_confirmed_at) && !publicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = user ? "error=verify" : "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.headers.set("x-request-id", requestId);
    return redirectResponse;
  }

  if (user?.email_confirmed_at && requiresMfa && !publicPath) {
    const redirectResponse = NextResponse.redirect(
      new URL("/login?mfa=1", request.url)
    );
    redirectResponse.headers.set("x-request-id", requestId);
    return redirectResponse;
  }

  if (user?.email_confirmed_at && guestOnly && !requiresMfa) {
    const redirectResponse = NextResponse.redirect(
      new URL("/home", request.url)
    );
    redirectResponse.headers.set("x-request-id", requestId);
    return redirectResponse;
  }

  response.headers.set("x-request-id", requestId);
  return response;
}
