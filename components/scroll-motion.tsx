"use client";

import { useEffect } from "react";

const TARGET_SELECTOR = [
  ".post-card",
  ".side-card",
  ".welcome",
  ".story",
  ".feed-toolbar",
  ".auth-card",
  ".settings-card",
  ".settings-section",
  ".profile-card",
  ".reel-card",
  ".clip-card",
  ".feature-card",
  ".empty-state",
  ".modal-panel",
].join(",");

export default function ScrollMotion() {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-motion-visible", "true");
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -36px 0px" },
    );

    const register = (root: ParentNode) => {
      root.querySelectorAll(TARGET_SELECTOR).forEach((element) => {
        if (element.hasAttribute("data-motion-in")) return;
        element.setAttribute("data-motion-in", "true");
        observer.observe(element);
      });
    };

    document.documentElement.classList.add("avenzo-motion-ready");
    register(document);
    const mutation = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(TARGET_SELECTOR)) {
          node.setAttribute("data-motion-in", "true");
          observer.observe(node);
        }
        register(node);
      }));
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutation.disconnect();
      observer.disconnect();
      document.documentElement.classList.remove("avenzo-motion-ready");
    };
  }, []);

  return null;
}
