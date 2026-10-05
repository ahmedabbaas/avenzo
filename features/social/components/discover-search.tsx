"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "./icon";

const LIMIT = 8;
function readHistory(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((item): item is string =>
      typeof item === "string" && item.trim().length > 0 && item.length <= 120).slice(0, LIMIT) : [];
  } catch { return []; }
}

export default function DiscoverSearch({ userId, query, onChange, inputRef }: {
  userId: string;
  query: string;
  onChange: (value: string) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const key = "avenzo-recent-searches:" + userId;
  const [history, setHistory] = useState<string[]>([]);
  const historyRef = useRef<string[]>([]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const next = readHistory(key);
      historyRef.current = next;
      setHistory(next);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [key]);

  function save(next: string[]) {
    historyRef.current = next;
    setHistory(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Search works without storage. */ }
  }
  function search(value: string) {
    const clean = value.trim().slice(0, 120);
    onChange(clean);
    if (clean) save([clean, ...historyRef.current.filter(item => item.toLowerCase() !== clean.toLowerCase())].slice(0, LIMIT));
  }

  return <div className="discover-search">
    <form className="explore-search-box" role="search" onSubmit={event => {
      event.preventDefault(); search(query); inputRef.current?.blur();
    }}>
      <Icon name="search" size={19} />
      <input ref={inputRef} value={query} onChange={event => onChange(event.target.value.slice(0, 120))}
        placeholder="Search people, posts, clips or tags" aria-label="Search people, posts, clips or tags"
        autoComplete="off" inputMode="search" enterKeyHint="search" />
      {query && <button type="button" onClick={() => onChange("")} aria-label="Clear search"><Icon name="close" size={16} /></button>}
      <button type="submit" aria-label="Search" disabled={!query.trim()}><Icon name="search" size={18} /></button>
    </form>
    {!query.trim() && history.length > 0 && <section className="discover-recent" aria-label="Recent searches">
      <div className="discover-recent-head"><b>Recent searches</b><button type="button" onClick={() => save([])}>Clear all</button></div>
      <ul>{history.map(item => <li key={item}>
        <button type="button" className="discover-recent-query" onClick={() => search(item)}><Icon name="search" size={17} /><span>{item}</span></button>
        <button type="button" onClick={() => save(historyRef.current.filter(value => value !== item))} aria-label={"Remove search " + item}><Icon name="close" size={17} /></button>
      </li>)}</ul>
    </section>}
  </div>;
}
