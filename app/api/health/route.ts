import { NextResponse } from "next/server";
import {
  SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_URL,
} from "../../../lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId =
    request.headers.get("x-request-id") || crypto.randomUUID();

  const startedAt = performance.now();
  let database = "unreachable";

  try {
    const response = await fetch(
      SUPABASE_URL + "/rest/v1/rpc/is_username_available",
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_PUBLISHABLE_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate: "avenzo_health_probe",
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      }
    );

    if (response.ok) {
      database = "ok";
    }
  } catch {
    database = "unreachable";
  }

  const healthy = database === "ok";
  const latencyMs = Math.max(
    0,
    Math.round(performance.now() - startedAt)
  );

  return NextResponse.json(
    {
      ok: healthy,
      service: "avenzo",
      database,
      latencyMs,
      environment:
        process.env.VERCEL_ENV ||
        process.env.NODE_ENV ||
        "unknown",
      commit:
        process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
        "local",
      requestId,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
        "x-request-id": requestId,
      },
    }
  );
}
