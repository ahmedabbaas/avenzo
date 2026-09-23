export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://ltlxynrssgpqgzbdpliv.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_tAxyIZKlwXyeGI7627SFSQ_VJvaSR0d";

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
