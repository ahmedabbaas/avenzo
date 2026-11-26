"use client";

import { useEffect, useState } from "react";
import { Activity, AppWindow, Brush, Check, ChevronRight, Globe, Image as ImageIcon, LayoutDashboard, LockKeyhole, Save, Settings2, Shield, Sparkles, Upload, Users, type LucideIcon } from "lucide-react";
import "./admin.css";

type Settings = {
  brandName: string;
  tagline: string;
  logoUrl: string;
  faviconUrl: string;
  appIconUrl: string;
  primaryColor: string;
  surfaceColor: string;
  accentColor: string;
  fontFamily: string;
  maintenanceMode: boolean;
  features: Record<string, boolean>;
  customCss: string;
};
const defaults: Settings = {
  brandName: "AVENZO", tagline: "Connect. Share. Belong.", logoUrl: "", faviconUrl: "", appIconUrl: "",
  primaryColor: "#d8dde2", surfaceColor: "#101215", accentColor: "#b7c0c9", fontFamily: "Plus Jakarta Sans",
  maintenanceMode: false, features: { feed: true, stories: true, reels: true, messaging: true, calls: true, search: true }, customCss: "",
};
const sections: { name: string; icon: LucideIcon; heading: string; sub: string }[] = [
  { name: "Overview", icon: LayoutDashboard, heading: "Control room", sub: "Your private AVENZO control center." },
  { name: "Brand identity", icon: Brush, heading: "Brand identity", sub: "Edit name, tagline, logo and brand assets." },
  { name: "Appearance", icon: Sparkles, heading: "Visual appearance", sub: "Adjust the visual system without touching source code." },
  { name: "Features", icon: AppWindow, heading: "Feature switches", sub: "Enable or disable product areas." },
  { name: "Platform", icon: Settings2, heading: "Platform controls", sub: "Maintenance mode and custom CSS." },
];
const featureNames: Record<string, string> = { feed: "Feed", stories: "Stories", reels: "Reels", messaging: "Messaging", calls: "Calls", search: "Search" };

export default function AdminPanel({ email }: { email: string }) {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [section, setSection] = useState("Overview");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  useEffect(() => {
    fetch("/api/admin/settings", { cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("Admin storage is not configured yet. Add the required server environment variables.");
      const payload = await r.json();
      if (payload.settings) setSettings((s) => ({ ...s, ...payload.settings, features: { ...s.features, ...(payload.settings.features ?? {}) } }));
    }).catch((e) => setNotice(e.message)).finally(() => setLoaded(true));
  }, []);
  const update = (key: keyof Settings, value: Settings[keyof Settings]) => setSettings((s) => ({ ...s, [key]: value }));
  async function save() {
    setSaving(true); setNotice("");
    try {
      const response = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Save failed");
      setSettings(payload.settings); setNotice("Saved successfully. Changes are stored in the admin settings database.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Save failed."); }
    finally { setSaving(false); }
  }
  const active = sections.find((s) => s.name === section)!;
  return <main className="av-admin">
    <aside className="av-admin-side">
      <div className="av-admin-brand"><span className="av-admin-mark">A</span><span>AVENZO <small>CONTROL</small></span></div>
      <div className="av-admin-nav-label">WORKSPACE</div>
      {sections.map((item) => <button key={item.name} className={"av-admin-nav " + (section === item.name ? "active" : "")} onClick={() => setSection(item.name)}><item.icon size={17}/>{item.name}<ChevronRight size={14} className="av-admin-chevron"/></button>)}
      <div className="av-admin-side-bottom"><div className="av-admin-secure"><LockKeyhole size={16}/><div><b>Private workspace</b><small>Admin-only access</small></div></div><a href="/home" className="av-admin-back">← Return to AVENZO</a></div>
    </aside>
    <section className="av-admin-main">
      <header className="av-admin-top"><div><span className="av-admin-eyebrow">PRIVATE ADMIN / {section.toUpperCase()}</span><h1>{active.heading}</h1><p>{active.sub}</p></div><div className="av-admin-account"><span className="av-admin-online"/><span>{email}</span><Shield size={15}/></div></header>
      <div className="av-admin-body">
        {section === "Overview" && <div className="av-admin-overview">
          <div className="av-admin-hero"><div className="av-admin-hero-content"><span className="av-admin-chip"><Sparkles size={13}/> PRIVATE ADMINISTRATOR</span><h2>One place.<br/>Total control.</h2><p>Manage AVENZO's identity, product features and visual direction from a private dashboard.</p><button className="av-admin-cta" onClick={() => setSection("Brand identity")}>Customize brand <ChevronRight size={16}/></button></div><div className="av-admin-orb">A</div></div>
          <div className="av-admin-cards"><button onClick={() => setSection("Brand identity")}><ImageIcon/><span>Brand assets</span><small>Logo, name, icons</small></button><button onClick={() => setSection("Appearance")}><Brush/><span>Appearance</span><small>Colors and typography</small></button><button onClick={() => setSection("Features")}><AppWindow/><span>Feature control</span><small>Modules and visibility</small></button><button onClick={() => setSection("Platform")}><Activity/><span>Platform status</span><small>Maintenance and CSS</small></button></div>
          <div className="av-admin-info"><Shield size={18}/><div><b>Access is enforced on the server</b><p>This page and its save API require your configured admin email. The panel is not exposed to regular users and no admin controls are included in the public UI.</p></div></div>
        </div>}
        {section === "Brand identity" && <div className="av-admin-grid">
          <div className="av-admin-card"><h3>Brand details</h3><p>These fields become the core identity used across AVENZO.</p><label>App / brand name<input value={settings.brandName} maxLength={50} onChange={(e) => update("brandName", e.target.value)}/></label><label>Tagline<input value={settings.tagline} maxLength={160} onChange={(e) => update("tagline", e.target.value)}/></label><label>Logo image URL or path<input placeholder="/brand/logo.svg or https://" value={settings.logoUrl} onChange={(e) => update("logoUrl", e.target.value)}/></label><label>Browser favicon URL<input placeholder="/favicon.png" value={settings.faviconUrl} onChange={(e) => update("faviconUrl", e.target.value)}/></label><label>App icon URL<input placeholder="/app-icon.png" value={settings.appIconUrl} onChange={(e) => update("appIconUrl", e.target.value)}/></label><small className="av-admin-help">Asset upload/storage management will be wired as a dedicated secure upload workflow. These fields accept local paths or HTTPS URLs.</small></div>
          <div className="av-admin-card av-admin-preview-card"><h3>Identity preview</h3><div className="av-admin-brand-preview">{settings.logoUrl ? <img src={settings.logoUrl} alt="Brand preview"/> : <span className="av-admin-mark large">A</span>}<div><strong>{settings.brandName || "AVENZO"}</strong><small>{settings.tagline}</small></div></div><div className="av-admin-preview-caption">Live preview</div></div>
        </div>}
        {section === "Appearance" && <div className="av-admin-grid">
          <div className="av-admin-card"><h3>Color controls</h3><p>Pick the main color tokens for the design system.</p>{[["primaryColor","Primary / text"],["surfaceColor","Surface / background"],["accentColor","Accent / highlight"]].map(([key,label])=><label key={key} className="av-admin-color-label">{label}<div className="av-admin-color-control"><input type="color" value={settings[key as keyof Settings] as string} onChange={(e)=>update(key as keyof Settings,e.target.value)}/><input value={settings[key as keyof Settings] as string} onChange={(e)=>update(key as keyof Settings,e.target.value)} /></div></label>)}<label>Font family<input value={settings.fontFamily} onChange={(e)=>update("fontFamily",e.target.value)} placeholder="Plus Jakarta Sans"/></label></div>
          <div className="av-admin-card av-admin-preview-card" style={{background:settings.surfaceColor,color:settings.primaryColor,borderColor:settings.accentColor}}><h3>Preview</h3><div className="av-admin-preview-post"><div className="av-admin-preview-avatar">A</div><b>{settings.brandName}</b><p>Brand colors are previewed here. Save to persist your settings.</p><button style={{background:settings.accentColor,color:settings.surfaceColor}}>Sample action</button></div></div>
        </div>}
        {section === "Features" && <div className="av-admin-card"><h3>Feature toggles</h3><p>Switch product modules on or off. Integration into each route will follow these saved settings.</p><div className="av-admin-switches">{Object.entries(featureNames).map(([key,label])=><label className="av-admin-switch-row" key={key}><span><b>{label}</b><small>Enable {label.toLowerCase()} experience</small></span><input type="checkbox" checked={Boolean(settings.features[key])} onChange={(e)=>setSettings((s)=>({...s,features:{...s.features,[key]:e.target.checked}}))}/></label>)}</div></div>}
        {section === "Platform" && <div className="av-admin-card"><h3>Platform controls</h3><p>Operational settings and a controlled custom style override.</p><label className="av-admin-switch-row"><span><b>Maintenance mode</b><small>Toggle the platform maintenance flag. Public enforcement will be connected to the app shell.</small></span><input type="checkbox" checked={settings.maintenanceMode} onChange={(e)=>update("maintenanceMode",e.target.checked)}/></label><label>Custom CSS<textarea className="av-admin-css" rows={12} placeholder="/* Custom CSS override */" value={settings.customCss} onChange={(e)=>update("customCss",e.target.value)}/></label><small className="av-admin-help">Custom CSS is stored but not injected into the live app yet. Live integration will be added with validation and rollback safeguards.</small></div>}
        <div className="av-admin-savebar"><div>{notice && <span className={notice.startsWith("Saved") ? "success" : "warning"}>{notice.startsWith("Saved") && <Check size={15}/>} {notice}</span>}{!loaded && <span>Loading saved settings…</span>}</div><button className="av-admin-save" onClick={save} disabled={saving || !loaded}><Save size={16}/>{saving ? "Saving…" : "Save changes"}</button></div>
      </div>
    </section>
  </main>;
}
