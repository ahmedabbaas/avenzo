"use client";

type AvenzoNativeSocialBridge = {
  haptic?: (level: "light" | "medium" | "heavy") => void;
  shareContent?: (title: string, text: string, url: string) => void;
  extractImageText?: (dataUrl: string, script: string, callbackName: string) => void;
  processStudioImage?: (dataUrl: string, action: string, callbackName: string) => void;
  analyzeImage?: (dataUrl: string, callbackName: string) => void;
};

function bridge() {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { AvenzoNative?: AvenzoNativeSocialBridge })
    .AvenzoNative;
}

export function hasNativeMediaSense() {
  return Boolean(bridge()?.analyzeImage);
}

export function nativeImpact(level: "light" | "medium" | "heavy" = "light") {
  try {
    bridge()?.haptic?.(level);
  } catch {
    // Native haptics are enhancement-only.
  }
}

export async function shareExternal({
  title,
  text,
  url,
}: {
  title: string;
  text: string;
  url: string;
}) {
  nativeImpact("light");

  const native = bridge();
  if (native?.shareContent) {
    native.shareContent(title, text, url);
    return true;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return false;
      }
    }
  }

  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("IMAGE_READ_FAILED"));
    reader.onerror = () => reject(reader.error || new Error("IMAGE_READ_FAILED"));
    reader.readAsDataURL(blob);
  });
}

async function compactImageDataUrl(file: File, maxSide = 1280, mime = "image/jpeg") {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) { bitmap.close(); throw new Error("CANVAS_UNAVAILABLE"); }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) => (value ? resolve(value) : reject(new Error("IMAGE_ENCODE_FAILED"))),
        mime,
        maxSide > 1280 ? 0.94 : 0.84
      )
    );
    return await blobToDataUrl(blob);
  } catch {
    return await blobToDataUrl(file);
  }
}

export async function analyzeImageForAltText(file: File) {
  const native = bridge();
  if (!native?.analyzeImage) return null;

  const dataUrl = await compactImageDataUrl(file);
  const callbackName =
    "__avenzoMediaSense_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2);

  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve(value?.trim() || null);
    };

    (window as unknown as Record<string, unknown>)[callbackName] = (
      value: string
    ) => finish(value);

    const timeout = window.setTimeout(() => finish(null), 15000);

    try {
      native.analyzeImage?.(dataUrl, callbackName);
    } catch {
      finish(null);
    }
  });
}

export type TextScanScript = "latin" | "chinese" | "devanagari" | "japanese" | "korean";

export function hasNativeTextScan() { return Boolean(bridge()?.extractImageText); }

export async function extractImageText(file: File, script: TextScanScript) {
  const native = bridge();
  if (!native?.extractImageText) return null;
  const dataUrl = await compactImageDataUrl(file);
  if (dataUrl.length > 12000000) throw new Error("Image is too large to scan");
  const callbackName = "__avenzoTextScan_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  return await new Promise<string | null>((resolve) => {
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      resolve(value?.trim() || null);
    };
    (window as unknown as Record<string, unknown>)[callbackName] = (value: string) => finish(value);
    const timeout = window.setTimeout(() => finish(null), 30000);
    try { native.extractImageText?.(dataUrl, script, callbackName); } catch { finish(null); }
  });
}

export type StudioAction = "cutout" | "frame" | "codes";
export type StudioResult = { ok: boolean; error?: string; image?: string; codes?: { value: string; format: number }[] };
export function hasNativePhotoStudio() { return Boolean(bridge()?.processStudioImage); }

export async function processStudioImage(file: File, action: StudioAction): Promise<StudioResult> {
  const native = bridge();
  if (!native?.processStudioImage) throw new Error("Use the latest AVENZO Android app for offline Studio.");
  const dataUrl = await compactImageDataUrl(file, 2048, file.type === "image/png" ? "image/png" : "image/jpeg");
  if (dataUrl.length > 12000000) throw new Error("Choose a smaller image for Studio.");
  const callbackName = "__avenzoStudio_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (value?: string, error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      delete (window as unknown as Record<string, unknown>)[callbackName];
      if (error) { reject(error); return; }
      try {
        const result = JSON.parse(value || "{}") as StudioResult;
        if (typeof result.ok !== "boolean") throw new Error("Invalid Studio response");
        if (result.image && (!result.image.startsWith("data:image/png;base64,") || result.image.length > 12000000)) throw new Error("Invalid preview");
        resolve(result);
      } catch { reject(new Error("Studio could not read the result. Try again.")); }
    };
    (window as unknown as Record<string, unknown>)[callbackName] = (value: string) => finish(value);
    const timeout = window.setTimeout(() => finish(undefined, new Error("Studio timed out. Try a smaller photo.")), 45000);
    try { native.processStudioImage?.(dataUrl, action, callbackName); }
    catch { finish(undefined, new Error("Studio is unavailable. Try again.")); }
  });
}
