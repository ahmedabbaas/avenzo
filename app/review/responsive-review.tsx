"use client";

import { useState } from "react";
import Link from "next/link";

const SCREENS = [
  { name: "Home", path: "/home" },
  { name: "Discover", path: "/home?screen=explore" },
  { name: "Profile", path: "/home?screen=profile" },
  { name: "Clips", path: "/reels" },
  { name: "Messages", path: "/messages" },
  { name: "Settings", path: "/settings" },
  { name: "Appearance", path: "/settings/app" },
  { name: "Login", path: "/login" },
];

export default function ResponsiveReview() {
  const [width, setWidth] = useState(390);
  const [height, setHeight] = useState(844);
  const [screen, setScreen] = useState("/home");
  return <main className="responsive-review">
    <header><div><h1>AVENZO web preview</h1><p>Your real account in a phone-sized web viewport. Android hardware behavior is checked separately.</p></div>
      <Link href="/home">Return to AVENZO</Link></header>
    <div className="responsive-review-controls">
      <label>Screen<select value={screen} onChange={event => setScreen(event.target.value)}>{SCREENS.map(item => <option key={item.path} value={item.path}>{item.name}</option>)}</select></label>
      <label>Width<select value={width} onChange={event => setWidth(Number(event.target.value))}>{[320,360,390,430,768,1024,1440].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>
      <label>Height<select value={height} onChange={event => setHeight(Number(event.target.value))}>{[568,740,844,932].map(size => <option key={size} value={size}>{size}px</option>)}</select></label>
    </div>
    <button type="button" className="btn" onClick={() => {
      window.open(screen, "avenzo-web-preview", `popup=yes,width=${width},height=${height},noopener`);
    }}>Open {width} × {height} preview</button>
    <p>Your browser may adjust the requested window size. This opens the actual web app, with its existing account permissions.</p>
  </main>;
}
