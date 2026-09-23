import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim().toLowerCase() || "";

  if (!USERNAME_PATTERN.test(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("is_username_available", { candidate: username });

    if (error) throw error;

    return NextResponse.json({ available: Boolean(data), valid: true });
  } catch {
    return NextResponse.json({ error: "Account services are temporarily unavailable. Please try again shortly." }, { status: 503 });
  }
}
