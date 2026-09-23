import { NextResponse } from "next/server";
import { isValidUsername } from "../../../../features/auth/validation";
import {
  consumeRateLimit,
  rateLimitResponse,
} from "../../../../lib/security/rate-limit";
import { createClient } from "../../../../lib/supabase/server";

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const username =
    new URL(request.url).searchParams
      .get("username")
      ?.trim()
      .toLowerCase() || "";

  if (!isValidUsername(username)) {
    return json({ available: false, valid: false });
  }

  try {
    const supabase = await createClient();

    const rate = await consumeRateLimit({
      supabase,
      request,
      scope: "username-availability",
      subject: "lookup",
      limit: 60,
      windowSeconds: 60,
    });

    if (!rate.allowed) {
      return rateLimitResponse(rate.retryAfter);
    }

    const { data, error } = await supabase.rpc(
      "is_username_available",
      { candidate: username }
    );

    if (error) throw error;

    return json({ available: Boolean(data), valid: true });
  } catch {
    return json(
      { error: "Unable to check username availability right now." },
      503
    );
  }
}
