"use client";

import { useEffect, useRef } from "react";

export function useComposerLifecycle(onClose: () => void, busy: boolean) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ onClose, busy });
  useEffect(() => { stateRef.current = { onClose, busy }; }, [onClose, busy]);
  useEffect(() => {
    const root = document.documentElement;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    root.classList.add("avenzo-composer-open");
    document.body.style.overflow = "hidden";
    const frame = requestAnimationFrame(() => dialogRef.current?.focus());
    const viewport = window.visualViewport;
    function resize() {
      if (!viewport) return;
      root.style.setProperty("--composer-height", viewport.height + "px");
      root.style.setProperty("--composer-top", viewport.offsetTop + "px");
    }
    resize();
    viewport?.addEventListener("resize", resize);
    viewport?.addEventListener("scroll", resize);
    // Isolate the active modal on every route, including body-mounted portals.
    const siblings: HTMLElement[] = [];
    let branch: HTMLElement | null = dialogRef.current;
    while (branch?.parentElement) {
      const parent: HTMLElement = branch.parentElement;
      for (const child of parent.children) {
        if (child instanceof HTMLElement && child !== branch && !["SCRIPT", "STYLE", "LINK"].includes(child.tagName)) siblings.push(child);
      }
      if (parent === document.body) break;
      branch = parent;
    }
    const priorInert = siblings.map(node => node.inert);
    siblings.forEach(node => { node.inert = true; });
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape" && !stateRef.current.busy) { event.preventDefault(); stateRef.current.onClose(); }
      if (event.key !== "Tab") return;
      const nodes = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]') || [])].filter(node => node.getClientRects().length > 0);
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (!first) { event.preventDefault(); dialogRef.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialogRef.current)) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => {
      cancelAnimationFrame(frame);
      root.classList.remove("avenzo-composer-open");
      root.style.removeProperty("--composer-height");
      root.style.removeProperty("--composer-top");
      document.body.style.overflow = oldOverflow;
      siblings.forEach((node, index) => { node.inert = priorInert[index]; });
      document.removeEventListener("keydown", keydown);
      viewport?.removeEventListener("resize", resize);
      viewport?.removeEventListener("scroll", resize);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return dialogRef;
}
