import { NextResponse } from "next/server";
import { logServerError } from "../../../../lib/observability/server";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "../../../../lib/security/rate-limit";
import { createClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const code = String(body.code || "").replace(/\D/g, "").slice(0, 6);

    if (code.length !== 6) {
      return json({ error: "Enter the 6-digit authenticator code." }, 400);
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return json({ error: "Your sign-in session expired." }, 401);
    }

    const rate = await consumeRateLimit({
      supabase,
      request,
      scope: "mfa",
      subject: user.id,
      limit: 8,
      windowSeconds: 10 * 60,
    });

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    const { data: factors, error: factorsError } =
      await supabase.auth.mfa.listFactors();

    if (factorsError) throw factorsError;

    const factor = factors?.totp?.find(
      (item) => item.status === "verified"
    );

    if (!factor) {
      return json({ error: "No verified authenticator is configured." }, 400);
    }

    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    });

    if (error) {
      return json({ error: "Invalid authenticator code." }, 401);
    }

    return json({ ok: true });
  } catch (error) {
    logServerError({ request, route: "auth.mfa", error });
    return json({ error: "Unable to verify two-factor authentication." }, 503);
  }
}
