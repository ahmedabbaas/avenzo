import type { Post, Profile, Reel } from "../types";

export const DISCOVERY_PAGE_SIZE = 24;
export type DiscoverySearchPage = {
  people: Profile[];
  posts: Post[];
  reels: Reel[];
  page: number;
  hasMore: boolean;
};

// .or() uses raw PostgREST syntax. Never interpolate unrestricted user input.
export function discoveryTerm(value: string) {
  const term = value.trim().replace(/^[@#]/, "");
  if (!term || term.length > 120 || !/^[\p{L}\p{N}\s_.-]+$/u.test(term)) return null;
  return term.replace(/\s+/g, " ");
}

export function discoveryTextFilter(columns: string[], term: string) {
  const pattern = JSON.stringify("%" + term.replace(/_/g, "\\_") + "%");
  return columns.map(column => column + ".ilike." + pattern).join(",");
}
