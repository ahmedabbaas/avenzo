import { NextResponse } from "next/server";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "../../../../lib/security/rate-limit";
import { createClient } from "../../../../lib/supabase/server";
import { verifyTurnstile } from "../../../../lib/turnstile";

export const dynamic = "force-dynamic";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const turnstileToken = String(body.turnstileToken || "");

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return json({ error: "Enter a valid email address." }, 400);
    }

    const supabase = await createClient();

    const rate = await consumeRateLimit({
      supabase,
      request,
      scope: "password-reset",
      subject: email,
      limit: 5,
      windowSeconds: 30 * 60,
    });

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
  } catch {
    return json(
      { error: "Account services are temporarily unavailable." },
      503
    );
  }
}
