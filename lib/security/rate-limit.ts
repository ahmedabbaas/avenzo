import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type RateLimitDecision = {
  allowed: boolean;
  retryAfter: number;
};

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");

  return forwarded?.split(",")[0]?.trim() || realIp?.trim() || "unknown";
}

function hashKey(parts: string[]) {
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

export async function consumeRateLimit({
  supabase,
  request,
  scope,
  subject,
  limit,
  windowSeconds,
}: {
  supabase: SupabaseClient;
  request: Request;
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}): Promise<RateLimitDecision> {
  const keyHash = hashKey([
    "avenzo",
    scope,
    clientIp(request),
    subject.trim().toLowerCase(),
  ]);

  const { data, error } = await supabase.rpc("consume_auth_rate_limit", {
    candidate_key: keyHash,
    max_hits: limit,
    window_seconds: windowSeconds,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;

  return {
    allowed: Boolean(row?.allowed),
    retryAfter: Number(row?.retry_after || 0),
  };
}

export function rateLimitResponse(retryAfter: number) {
  const seconds = Math.max(1, Math.ceil(retryAfter || 1));

  return Response.json(
    {
      error: "Too many attempts. Please wait a little and try again.",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(seconds),
      },
    }
  );
}
