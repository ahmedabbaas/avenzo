import { NextResponse } from "next/server";
import { logServerError } from "../../../../lib/observability/server";
import {
  isValidEmail,
  normalizeEmail,
} from "../../../../features/auth/validation";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "../../../../lib/security/rate-limit";
import { createClient } from "../../../../lib/supabase/server";
import { verifyTurnstile } from "../../../../lib/turnstile";

export const dynamic = "force-dynamic";

// Temporary per-instance fallback when the database rate-limit RPC is unavailable.
const fallbackBuckets = new Map<string, { count: number; expires: number }>();
function fallbackLimit(request: Request, email: string) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = ip + "|" + email.toLowerCase();
  const now = Date.now();
  const current = fallbackBuckets.get(key);
  if (!current || current.expires <= now) {
    fallbackBuckets.set(key, { count: 1, expires: now + 30 * 60_000 });
    return { allowed: true, retryAfter: 0 };
  }
  current.count += 1;
  return { allowed: current.count <= 5, retryAfter: Math.max(1, Math.ceil((current.expires - now) / 1000)) };
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    let body: Record<string, unknown>;

    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return json({ error: "Invalid password reset request." }, 400);
    }

    const email = normalizeEmail(String(body.email || ""));
    const turnstileToken = String(body.turnstileToken || "");

    if (!isValidEmail(email)) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    const supabase = await createClient();

    let rate;
    try {
      rate = await consumeRateLimit({
        supabase,
        request,
        scope: "password-reset",
        subject: email,
        limit: 5,
        windowSeconds: 30 * 60,
      });
    } catch (rateError) {
      console.error("auth.forgot-password rate-limit RPC failed; fallback activated", JSON.stringify(rateError));
      rate = fallbackLimit(request, email);
    }

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    const verified = await verifyTurnstile(
      request,
      turnstileToken,
      "password_reset"
    );

    if (!verified) {
      return json(
        { error: "Verification failed. Please try again." },
        403
      );
    }

    const origin = new URL(request.url).origin;

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo:
        origin + "/auth/confirm?next=/reset-password",
    });

    return json({
      ok: true,
      message:
        "If an account exists for that email, a password reset link has been sent.",
    });
  } catch (error) {
    logServerError({ request, route: "auth.forgot-password", error });
    return json(
      { error: "Account services are temporarily unavailable." },
      503
    );
  }
}
