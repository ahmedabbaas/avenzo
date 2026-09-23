import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";
import { verifyTurnstile } from "../../../../lib/turnstile";

export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");
    const turnstileToken = String(body.turnstileToken || "");

    if (
      !identifier ||
      !password ||
      identifier.length > 254 ||
      password.length > 1024
    ) {
      return json(
        { error: "Username/email and password are required." },
        400
      );
    }

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

    let email = identifier;

    if (!identifier.includes("@")) {
      if (!USERNAME_PATTERN.test(identifier)) {
        return json({ error: "Invalid username/email or password." }, 401);
      }

      const admin = createAdminClient();
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", identifier)
        .maybeSingle();

      if (profileError || !profile) {
        return json({ error: "Invalid username/email or password." }, 401);
      }

      const { data: userData, error: userError } =
        await admin.auth.admin.getUserById(profile.id);

      if (userError || !userData.user?.email) {
        return json({ error: "Invalid username/email or password." }, 401);
      }

      email = userData.user.email;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      const message = error?.message?.toLowerCase().includes("confirm")
        ? "Verify your email before signing in."
        : "Invalid username/email or password.";

      return json({ error: message }, 401);
    }

    return json({ ok: true });
  } catch {
    return json(
      { error: "Account services are temporarily unavailable." },
      503
    );
  }
}
