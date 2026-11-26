// AVENZO is linked to this Supabase project. Keep the canonical API host fixed
// so a Vercel domain/env migration cannot redirect Auth calls to another project.
export const SUPABASE_URL = "https://ltlxynrssgpqgzbdpliv.supabase.co";

export const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_tAxyIZKlwXyeGI7627SFSQ_VJvaSR0d";

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}
