import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { createAdminClient } from "../../../../lib/supabase/admin";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const identifier = String(body.identifier || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username/email and password are required." }, { status: 400 });
    }

    let email = identifier;

    if (!identifier.includes("@")) {
      if (!USERNAME_PATTERN.test(identifier)) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }

      const admin = createAdminClient();
      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id")
        .eq("username", identifier)
        .maybeSingle();

      if (profileError || !profile) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }

      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (userError || !userData.user?.email) {
        return NextResponse.json({ error: "Invalid username/email or password." }, { status: 401 });
      }

      email = userData.user.email;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      const message = error?.message?.toLowerCase().includes("confirm")
        ? "Verify your email before signing in."
        : "Invalid username/email or password.";
      return NextResponse.json({ error: message }, { status: 401 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "AVENZO backend is not fully configured." }, { status: 503 });
  }
}
