import { createClient } from "../../../../lib/supabase/server";
import { consumeRateLimit, rateLimitResponse } from "../../../../lib/security/rate-limit";
import { searchDiscovery } from "../../../../features/social/data/queries";
import { discoveryTerm } from "../../../../features/social/lib/discovery-search";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const term = discoveryTerm(params.get("q") || "");
  const pageValue = params.get("page") || "0";
  if (!term || !/^\d{1,2}$/.test(pageValue)) {
    return Response.json({ error: "Search with letters, numbers, spaces, dots, underscores or hyphens." }, { status:400, headers });
  }
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user?.email_confirmed_at) return Response.json({ error:"Sign in to search AVENZO." }, { status:401, headers });
    const decision = await consumeRateLimit({ supabase, request, scope:"discovery-search", subject:user.id, limit:60, windowSeconds:60 });
    if (!decision.allowed) return rateLimitResponse(decision.retryAfter);
    // Cookie-authenticated publishable client: all queries retain existing RLS.
    const result = await searchDiscovery(supabase, user.id, term, Number(pageValue), params.get("kind") === "people");
    return Response.json(result, { headers });
  } catch {
    return Response.json({ error:"Search is unavailable right now. Try again." }, { status:503, headers });
  }
}
