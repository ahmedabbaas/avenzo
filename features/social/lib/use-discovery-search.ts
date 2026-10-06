"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverySearchPage } from "./discovery-search";

const EMPTY: DiscoverySearchPage = { people:[], posts:[], reels:[], page:0, hasMore:false };

function mergeRows<T extends { id: string }>(current: T[], next: T[]) {
  return [...new Map([...current, ...next].map(row => [row.id, row])).values()];
}

export function useDiscoverySearch(query: string, enabled: boolean) {
  const term = query.trim();
  const active = enabled && term.length > 0;
  const [state, setState] = useState({ term:"", data:EMPTY, loading:false, error:"" });
  const requestRef = useRef<AbortController | null>(null);

  const requestPage = useCallback(async (requestedTerm: string, page: number) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    setState(current => ({ term:requestedTerm, data:page ? current.data : EMPTY, loading:true, error:"" }));
    try {
      const response = await fetch("/api/discover/search?q=" + encodeURIComponent(requestedTerm) + "&page=" + page, {
        signal:controller.signal, cache:"no-store",
      });
      if (!response.headers.get("content-type")?.includes("application/json")) {
        throw new Error(response.redirected ? "Your session expired. Sign in again to search." : "Search is unavailable right now. Try again.");
      }
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === "string" ? result.error : "Search could not load.");
      if (!Array.isArray(result.people) || !Array.isArray(result.posts) || !Array.isArray(result.reels) || result.page !== page) throw new Error("Search returned an incomplete response. Try again.");
      if (controller.signal.aborted) return;
      const next = result as DiscoverySearchPage;
      setState(current => ({ term:requestedTerm, loading:false, error:"", data:page ? {
        ...next, people:mergeRows(current.data.people, next.people), posts:mergeRows(current.data.posts, next.posts), reels:mergeRows(current.data.reels, next.reels),
      } : next }));
    } catch (error) {
      if (requestRef.current !== controller || (controller.signal.aborted && !timedOut)) return;
      setState(current => ({ ...current, loading:false, error:timedOut ? "Search took too long. Try again." : error instanceof Error ? error.message : "Search is unavailable. Try again." }));
    } finally {
      window.clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    requestRef.current?.abort();
    if (!active) return;
    const timer = window.setTimeout(() => { void requestPage(term, 0); }, 220);
    return () => { window.clearTimeout(timer); requestRef.current?.abort(); };
  }, [active, term, requestPage]);

  const current = state.term === term;
  return {
    active,
    data:active && current ? state.data : EMPTY,
    loading:active && (!current || state.loading),
    error:active && current ? state.error : "",
    retry:() => { if (active) void requestPage(term, 0); },
    loadMore:() => { if (active && current && !state.loading && state.data.hasMore && state.data.page < 99) void requestPage(term, state.data.page + 1); },
  };
}
