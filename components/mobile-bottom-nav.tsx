"use client";

import { useEffect, useState } from "react";
import Icon from "../features/social/components/icon";
import AvatarImage from "../features/social/components/avatar-image";

export type MobilePrimaryTab = "home" | "search" | "create" | "reels" | "profile";

type MobileBottomNavProps = {
  active: MobilePrimaryTab | null;
  onHome: () => void;
  onSearch: () => void;
  onCreate: () => void;
  onReels: () => void;
  onProfile: () => void;
  profileAvatarUrl?: string;
};

const ITEMS: Array<{
  id: MobilePrimaryTab;
  label: string;
  icon: "home" | "search" | "plus" | "reels" | "profile";
}> = [
  { id: "home", label: "Pulse", icon: "home" },
  { id: "search", label: "Discover", icon: "search" },
  { id: "create", label: "Create", icon: "plus" },
  { id: "reels", label: "Clips", icon: "reels" },
  { id: "profile", label: "You", icon: "profile" },
];

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]'
    )
  );
}

export default function MobileBottomNav({
  active,
  onHome,
  onSearch,
  onCreate,
  onReels,
  onProfile,
  profileAvatarUrl = "",
}: MobileBottomNavProps) {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    let focusedTyping = isTypingTarget(document.activeElement);

    const syncKeyboardState = () => {
      const viewport = window.visualViewport;
      const viewportShrunk = viewport
        ? window.innerHeight - viewport.height > 120
        : false;

      setKeyboardOpen(focusedTyping || viewportShrunk);
    };

    const handleFocusIn = (event: FocusEvent) => {
      focusedTyping = isTypingTarget(event.target);
      syncKeyboardState();
    };

    const handleFocusOut = () => {
      window.setTimeout(() => {
        focusedTyping = isTypingTarget(document.activeElement);
        syncKeyboardState();
      }, 80);
    };

    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.visualViewport?.addEventListener("resize", syncKeyboardState);
    window.visualViewport?.addEventListener("scroll", syncKeyboardState);
    syncKeyboardState();

    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.visualViewport?.removeEventListener("resize", syncKeyboardState);
      window.visualViewport?.removeEventListener("scroll", syncKeyboardState);
    };
  }, []);

  const actions: Record<MobilePrimaryTab, () => void> = {
    home: onHome,
    search: onSearch,
    create: onCreate,
    reels: onReels,
    profile: onProfile,
  };

  return (
    <nav
      className={
        "mobile-nav mobile-bottom-nav" +
        (keyboardOpen ? " mobile-nav--keyboard-hidden" : "")
      }
      aria-label="Primary mobile navigation"
    >
      {ITEMS.map((item) => {
        const selected = active === item.id;

        return (
          <button
            key={item.id}
            type="button"
            className={
              "mobile-nav-item avenzo-primary-" +
              item.id +
              (item.id === "create" ? " mobile-create" : "") +
              (selected ? " active" : "")
            }
            onClick={actions[item.id]}
            aria-label={item.label}
            aria-current={selected ? "page" : undefined}
          >
            <span className="mobile-icon-wrap" aria-hidden="true">
              {item.id === "profile" && profileAvatarUrl ? (
                <AvatarImage
                  src={profileAvatarUrl}
                  alt=""
                  size={48}
                  className="mobile-nav-profile-avatar"
                />
              ) : (
                <Icon name={item.icon} />
              )}
            </span>
            {item.id !== "create" && <small>{item.label}</small>}
          </button>
        );
      })}
    </nav>
  );
}
