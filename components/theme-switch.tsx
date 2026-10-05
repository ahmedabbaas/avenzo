"use client";

import { useEffect, useState } from "react";
import Icon from "../features/social/components/icon";

export default function ThemeSwitch() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const sync = () => setDark(document.documentElement.dataset.theme === "dark");
    const timer = window.setTimeout(sync, 0);
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => { window.clearTimeout(timer); observer.disconnect(); };
  }, []);

  function toggle() {
    const root = document.documentElement;
    const theme = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = theme;
    root.dataset.themePreference = theme;
    root.style.colorScheme = theme;
    try {
      const raw = localStorage.getItem("avenzo-visual-preferences");
      const saved = raw ? JSON.parse(raw) : {};
      localStorage.setItem("avenzo-visual-preferences", JSON.stringify({ ...saved, theme }));
    } catch { /* Guest theme still works without storage. */ }
    window.dispatchEvent(new CustomEvent("avenzo:theme", { detail: { preference: theme, effectiveTheme: theme } }));
  }

  return <button type="button" className="premium-theme-switch" onClick={toggle}
    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}>
    <Icon name={dark ? "sun" : "moon"} size={20} />
    <span>{dark ? "Light" : "Dark"}</span>
  </button>;
}
