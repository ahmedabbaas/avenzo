"use client";

import { useEffect, useRef, useState } from "react";
import { extractImageText, hasNativeTextScan, type TextScanScript } from "../lib/native-social";
import Icon from "./icon";

export default function ImageTextScan({ file, busy, caption, onCaptionChange }: {
  file: File | null; busy: boolean; caption: string; onCaptionChange: (value: string) => void;
}) {
  const [available, setAvailable] = useState(false);
  const [script, setScript] = useState<TextScanScript>("latin");
  const [scanning, setScanning] = useState(false);
  const [text, setText] = useState("");
  const [note, setNote] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setAvailable(hasNativeTextScan()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => {
    generation.current += 1;
    const timer = window.setTimeout(() => { setText(""); setNote(""); setScanning(false); }, 0);
    return () => { generation.current += 1; window.clearTimeout(timer); };
  }, [file, script]);
  async function scan() {
    if (!file || scanning || busy) return;
    const request = ++generation.current;
    setScanning(true); setNote(""); setText("");
    try {
      const result = await extractImageText(file, script);
      if (request !== generation.current) return;
      setText(result?.slice(0, 12000) || "");
      setNote(result ? "Review the extracted text before adding it." : "No readable text found. Try a sharper image or another script.");
    } catch {
      if (request === generation.current) setNote("This image could not be scanned. Try another image.");
    } finally {
      if (request === generation.current) setScanning(false);
    }
  }
  if (!available) return null;
  const room = 2200 - caption.length - (caption ? 2 : 0);
  return <section className="create-text-scan" aria-label="Extract image text">
    <div><b>Text from your photo</b><p>Scan on your device, even offline. Your image stays on this device during scanning.</p></div>
    <label className="create-field"><span>Writing system</span>
      <select value={script} disabled={scanning || busy} onChange={event => setScript(event.target.value as TextScanScript)}>
        <option value="latin">Latin · English and European languages</option>
        <option value="devanagari">Devanagari · Hindi and Marathi</option>
        <option value="chinese">Chinese</option><option value="japanese">Japanese</option><option value="korean">Korean</option>
      </select>
    </label>
    <button type="button" className="secondary-button" disabled={!file || busy || scanning} onClick={() => void scan()}>
      <Icon name="scan" size={18} />{scanning ? "Reading image…" : "Extract text"}
    </button>
    {text && <><label className="create-field"><span>Extracted text</span><textarea value={text} maxLength={12000} onChange={event => setText(event.target.value)} /></label>
      <button type="button" className="secondary-button" disabled={busy || room <= 0 || !text.trim()} onClick={() => {
        const addition = text.trim().slice(0, room);
        onCaptionChange(caption + (caption ? "\n\n" : "") + addition);
        setNote(addition.length < text.trim().length ? "Added up to the caption limit. The remaining text is still here." : "Added to your caption.");
      }}>Add to caption</button></>}
    {note && <p role="status">{note}</p>}
  </section>;
}
