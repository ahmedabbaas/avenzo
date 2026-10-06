"use client";

import { useEffect, useState } from "react";

export const FINISHES = [
  { id: "chrome", label: "Chrome", color: "#9da6b1" },
  { id: "citron", label: "Citron", color: "#c5f74f" },
  { id: "ocean", label: "Ocean", color: "#7ab8e6" },
  { id: "copper", label: "Copper", color: "#d6a17a" },
] as const;

export default function AppearanceFinish() {
  const [selected, setSelected] = useState("chrome");
  useEffect(() => {
    const timer = window.setTimeout(() => setSelected(document.documentElement.dataset.finish || "chrome"), 0);
    return () => window.clearTimeout(timer);
  }, []);
  function select(id: string) {
    setSelected(id);
    document.documentElement.setAttribute("data-finish", id);
    try { localStorage.setItem("avenzo-appearance-finish", id); } catch { /* Still applies for this session. */ }
  }
  return <div className="appearance-finish-wrap"><div className="appearance-finish" role="group" aria-label="Accent finish on this device">
    {FINISHES.map(item => <button type="button" key={item.id}
      className={selected === item.id ? "selected" : ""} aria-pressed={selected === item.id}
      onClick={() => select(item.id)}>
      <i style={{ background: item.color }} aria-hidden="true" />
      <span>{item.label}</span>
    </button>)}
  </div><button type="button" className="appearance-reset" disabled={selected === "chrome"} onClick={() => select("chrome")}>Reset accent to Chrome</button></div>;
}
