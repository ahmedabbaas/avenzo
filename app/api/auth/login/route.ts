import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logServerError } from "../../../../lib/observability/server";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "../../../../lib/security/rate-limit";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "../../../../lib/supabase/config";
import { createClient } from "../../../../lib/supabase/server";
import { verifyTurnstile } from "../../../../lib/turnstile";

export const dynamic = "force-dynamic";

// Temporary per-instance fallback if database rate-limit RPC fails.
const fallbackBuckets = new Map<string, { count: number; expires: number }>();
function fallbackLimit(request: Request, identifier: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = ip + "|" + identifier.toLowerCase();
  const now = Date.now();
  const current = fallbackBuckets.get(key);
  if (!current || current.expires <= now) {
    fallbackBuckets.set(key, { count: 1, expires: now + 600_000 });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return { allowed: current.count <= 10, retryAfter: Math.max(1, Math.ceil((current.expires - now) / 1000)) };
}


function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let diagnosticStage = "request-start";
  try {
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json(
        { error: "Invalid sign-in request.", field: "form" },
        400
      );
    }

    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");
    const turnstileToken = String(body.turnstileToken || "");
    const rememberSession = body.rememberSession !== false;

    if (
      !identifier ||
      !password ||
      identifier.length > 254 ||
      password.length > 1024
    ) {
      return json(
        {
          error: "Enter your username/email and password.",
          field: !identifier ? "identifier" : "password",
        },
        400
      );
    }

    diagnosticStage = "create-supabase-client";
    const supabase = await createClient();

    let rate;
    try {
      rate = await consumeRateLimit({ supabase, request, scope: "login", subject: identifier, limit: 10, windowSeconds: 10 * 60 });
    } catch (rateError) {
      console.error("auth.login rate-limit RPC failed; fallback activated", JSON.stringify(rateError));
      rate = fallbackLimit(request, identifier);
    }

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    diagnosticStage = "turnstile-verification";
    const verified = await verifyTurnstile(
      request,
      turnstileToken,
      "login"
    );

    if (!verified) {
      return json(
        { error: "Verification failed. Please try again." },
        403
      );
    }

    // Email sign-in goes directly through Supabase Auth. The username Edge
    // Function is only needed for username-to-email lookup, avoiding an
    // unnecessary dependency for the common email login path.
    let userId = "";
    let needsSetSession = false;

    if (identifier.includes("@")) {
      diagnosticStage = "direct-email-auth";
      const { data, error } = await supabase.auth.signInWithPassword({
        email: identifier,
        password,
      });

      if (error || !data.user || !data.session) {
        const message = error?.message?.toLowerCase().includes("confirm")
          ? "Verify your email before signing in."
          : "The username/email or password is incorrect.";
        return json({ error: message, field: "credentials" }, 401);
      }
      userId = data.user.id;
    } else {
      diagnosticStage = "username-login-edge-function-fetch";
      const response = await fetch(
        SUPABASE_URL + "/functions/v1/username-login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ identifier, password }),
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }
      );

      diagnosticStage = "username-login-edge-function-response-json";
      const result = await response.json();

      if (!response.ok || !result.access_token || !result.refresh_token) {
        console.error("auth.login username function response", JSON.stringify({
          status: response.status,
          error: result?.error || "No error detail",
        }));
        return json(
          {
            error:
              response.status === 401
                ? "The username/email or password is incorrect."
                : result.error || "Account services are temporarily unavailable.",
            field: response.status === 401 ? "credentials" : "form",
          },
          response.status === 401 ? 401 : 503
        );
      }

      userId = result.user?.id || "";
      needsSetSession = true;
      diagnosticStage = "username-set-session";
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) {
        console.error("auth.login username session error", sessionError.message);
        return json(
          { error: "Your session could not be started. Please try again.", field: "form" },
          503
        );
      }
    }

    diagnosticStage = "cookie-write";
    const cookieStore = await cookies();

    if (rememberSession) {
      cookieStore.delete("avenzo-session-scope");
    } else {
      cookieStore.set("avenzo-session-scope", "session", {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

    diagnosticStage = "profile-update";
    if (userId) {
      await supabase
        .from("profiles")
        .update({ deactivated_at: null })
        .eq("id", userId);
    }

    diagnosticStage = "mfa-assurance-level";
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    const requiresMfa =
      aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2";

    return json({ ok: true, requiresMfa });
  } catch (error) {
    const diagnostic = error && typeof error === "object" ? JSON.stringify(error) : String(error);
    console.error("auth.login diagnostic", JSON.stringify({ stage: diagnosticStage, error: diagnostic }));
    logServerError({ request, route: "auth.login", error });
    return json(
      { error: "Account services are temporarily unavailable." },
      503
    );
  }
}
