import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const origin = new URL(request.url).origin;

    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: origin + "/auth/confirm?next=/reset-password",
    });

    return NextResponse.json({
      ok: true,
      message: "If an account exists for that email, a password reset link has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "Account services are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
