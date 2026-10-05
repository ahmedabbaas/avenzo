"use client";

import { useEffect, useRef, useState } from "react";
import { hasNativePhotoStudio, processStudioImage, type StudioAction } from "../lib/native-social";
import UserMediaImage from "./user-media-image";
import Icon from "./icon";

const errors: Record<string, string> = {
  NO_PERSON: "No clear person found. Try a well-lit portrait with the subject visible.",
  BUSY: "Studio is still finishing another photo. Try again in a moment.",
  OUTPUT_TOO_LARGE: "This preview is too large. Try a smaller photo.",
};

function previewFile(data: string, name: string) {
  const bytes = atob(data.slice(data.indexOf(",") + 1));
  const buffer = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
  return new File([buffer], name.replace(/\.[^.]+$/, "") + "-studio.png", { type: "image/png" });
}

export default function NativePhotoStudio({ file, busy, onReplace, onBusyChange }: {
  file: File | null; busy: boolean; onReplace: (file: File) => Promise<void>;
  onBusyChange: (busy: boolean) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState("");
  const [note, setNote] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const undo = useRef<{ before: File; after: File } | null>(null);
  const generation = useRef(0);
  const busyCallback = useRef(onBusyChange);
  useEffect(() => { busyCallback.current = onBusyChange; }, [onBusyChange]);
  useEffect(() => {
    const counter = generation;
    const timer = window.setTimeout(() => setAvailable(hasNativePhotoStudio()), 0);
    return () => { window.clearTimeout(timer); counter.current++; busyCallback.current(false); };
  }, []);
  useEffect(() => {
    const counter = generation;
    counter.current++;
    if (undo.current?.after !== file) undo.current = null;
    const timer = window.setTimeout(() => {
      setPreview(""); setCodes([]); setNote(""); setWorking(false); setCanUndo(Boolean(undo.current));
      busyCallback.current(false);
    }, 0);
    return () => { window.clearTimeout(timer); counter.current++; };
  }, [file]);

  async function run(action: StudioAction) {
    if (!file || busy || working) return;
    const request = ++generation.current;
    setWorking(true); onBusyChange(true); setPreview(""); setCodes([]); setNote("");
    try {
      const result = await processStudioImage(file, action);
      if (request !== generation.current) return;
      if (!result.ok) { setNote(errors[result.error || ""] || "Studio could not process this image. Try another photo."); return; }
      if (action === "codes") {
        const values = (result.codes || []).filter(code => typeof code.value === "string").map(code => code.value.slice(0, 4096));
        setCodes(values); setNote(values.length ? "Review the scanned text. Links are never opened automatically." : "No readable code found. Try a sharper photo with the whole code visible.");
      } else {
        setPreview(result.image || "");
        setNote(action === "cutout" ? "Portrait cutout preview. Check hair and edges before applying. Transparent PNG, up to 2048 pixels." : "4:5 framing preview for the most prominent person. Check the crop before applying.");
      }
    } catch (error) {
      if (request === generation.current) setNote(error instanceof Error ? error.message : "Studio failed. Try again.");
    } finally {
      if (request === generation.current) { setWorking(false); onBusyChange(false); }
    }
  }
  async function replace(isUndo: boolean) {
    if (!file || busy || working || (!isUndo && !preview)) return;
    const request = ++generation.current;
    const previous = undo.current;
    const next = isUndo ? previous?.before : previewFile(preview, file.name);
    if (!next) return;
    undo.current = isUndo ? null : { before: file, after: next };
    setWorking(true); onBusyChange(true);
    try {
      await onReplace(next);
      if (request === generation.current) { setPreview(""); setCanUndo(!isUndo); setNote(isUndo ? "Previous photo restored." : "Applied. Undo is available while this editor is open."); }
    } catch {
      undo.current = previous;
      if (request === generation.current) setNote("Could not replace the photo. Your current image is unchanged.");
    } finally {
      if (request === generation.current) { setWorking(false); onBusyChange(false); }
    }
  }
  if (!available) return null;
  return <section className="create-photo-studio" aria-label="Offline photo Studio" aria-busy={working}>
    <div className="studio-heading"><Icon name="sliders" size={20} /><b>Portrait Studio</b><span>On device</span></div>
    <p>Shape your portrait privately. Preview every edit before applying it.</p>
    <div className="studio-actions">
      <button type="button" disabled={!file || busy || working} onClick={() => void run("cutout")}>Remove background</button>
      <button type="button" disabled={!file || busy || working} onClick={() => void run("frame")}>Smart 4:5 frame</button>
      <button type="button" disabled={!file || busy || working} onClick={() => void run("codes")}><Icon name="scan" size={18} />Read QR / barcode</button>
    </div>
    {preview && <><div className="studio-preview"><UserMediaImage src={preview} alt="Proposed Studio edit" loading="eager" /></div>
      <div className="studio-actions"><button type="button" disabled={busy || working} onClick={() => void replace(false)}>Apply preview</button>
      <button type="button" disabled={busy || working} onClick={() => { setPreview(""); setNote("Preview discarded. Your photo is unchanged."); }}>Discard</button></div></>}
    {canUndo && <button type="button" className="secondary-button" disabled={busy || working} onClick={() => void replace(true)}>Undo last Studio edit</button>}
    {codes.map((value, index) => <div className="studio-code" key={index}><pre>{value}</pre><button type="button" disabled={busy || working} onClick={() => {
      void navigator.clipboard.writeText(value).then(() => setNote("Copied."), () => setNote("Copy unavailable. Select the text above to copy it."));
    }}>Copy text</button></div>)}
    <p role="status" aria-live="polite">{working ? "Working on your device…" : note}</p>
  </section>;
}
