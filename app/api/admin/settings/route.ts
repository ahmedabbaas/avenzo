import { NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { isAdminEmail } from "../../../../lib/admin/auth";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "../../../../lib/supabase/config";

export const dynamic = "force-dynamic";

const SETTINGS_KEY = "brand";
const MAX_STRING = 4000;

async function authorize() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAdminEmail(user?.email)) return null;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createSupabaseClient(SUPABASE_URL, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function GET() {
  const db = await authorize();
  if (!db) return NextResponse.json({ error: "Not authorized or admin backend not configured." }, { status: 403 });
  const { data, error } = await db.from("admin_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  if (error) return NextResponse.json({ error: "Admin settings storage unavailable." }, { status: 503 });
  return NextResponse.json({ settings: data?.value ?? null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const db = await authorize();
  if (!db) return NextResponse.json({ error: "Not authorized or admin backend not configured." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Settings must be an object." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const allowed = ["brandName", "tagline", "logoUrl", "faviconUrl", "appIconUrl", "primaryColor", "surfaceColor", "accentColor", "fontFamily", "maintenanceMode", "features", "customCss"];
  if (Object.keys(input).some((key) => !allowed.includes(key))) return NextResponse.json({ error: "Unsupported settings field." }, { status: 400 });
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === "string" && value.length > MAX_STRING) return NextResponse.json({ error: key + " is too long." }, { status: 400 });
  }
  if (input.brandName !== undefined && (typeof input.brandName !== "string" || input.brandName.trim().length < 1 || input.brandName.length > 50)) return NextResponse.json({ error: "Brand name must be 1–50 characters." }, { status: 400 });
  if (input.tagline !== undefined && (typeof input.tagline !== "string" || input.tagline.length > 160)) return NextResponse.json({ error: "Tagline is too long." }, { status: 400 });
  for (const key of ["logoUrl", "faviconUrl", "appIconUrl"] as const) {
    const value = input[key];
    if (value !== undefined && typeof value !== "string") return NextResponse.json({ error: "Invalid " + key }, { status: 400 });
    if (typeof value === "string" && value && !value.startsWith("/") && !/^https:\/\//i.test(value)) return NextResponse.json({ error: key + " must be an HTTPS URL or local path." }, { status: 400 });
  }
  if (input.maintenanceMode !== undefined && typeof input.maintenanceMode !== "boolean") return NextResponse.json({ error: "maintenanceMode must be boolean." }, { status: 400 });
  if (input.features !== undefined && (!input.features || typeof input.features !== "object" || Array.isArray(input.features))) return NextResponse.json({ error: "features must be an object." }, { status: 400 });
  const { data: existing } = await db.from("admin_settings").select("value").eq("key", SETTINGS_KEY).maybeSingle();
  const merged = { ...(existing?.value ?? {}), ...input };
  const { error } = await db.from("admin_settings").upsert({ key: SETTINGS_KEY, value: merged, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return NextResponse.json({ error: "Save failed." }, { status: 500 });
  return NextResponse.json({ ok: true, settings: merged });
}
