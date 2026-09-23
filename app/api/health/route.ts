import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const backendConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );

  return NextResponse.json(
    {
      ok: true,
      service: "avenzo",
      backendConfigured,
      timestamp: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
