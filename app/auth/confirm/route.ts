import { NextResponse } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "../../../lib/supabase/server";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/home";
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  try {
    const supabase = await createClient();
    let error = null;

    if (code) {
      ({ error } = await supabase.auth.exchangeCodeForSession(code));
    } else if (tokenHash && type) {
      ({ error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }));
    } else {
      error = new Error("Missing confirmation token.");
    }

    if (error) throw error;
    return NextResponse.redirect(new URL(next, request.url));
  } catch {
    return NextResponse.redirect(new URL("/login?error=confirmation", request.url));
  }
}
