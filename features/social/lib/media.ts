export type MediaDimensions = {
  width: number;
  height: number;
};

export async function readImageDimensions(
  file: File
): Promise<MediaDimensions | null> {
  if (!file.type.startsWith("image/")) return null;

  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = {
        width: bitmap.width,
        height: bitmap.height,
      };
      bitmap.close();

      if (dimensions.width > 0 && dimensions.height > 0) {
        return dimensions;
      }
    } catch {
      // Fall back to an object URL when the browser cannot decode via ImageBitmap.
    }
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const dimensions =
        image.naturalWidth > 0 && image.naturalHeight > 0
          ? {
              width: image.naturalWidth,
              height: image.naturalHeight,
            }
          : null;

      URL.revokeObjectURL(url);
      resolve(dimensions);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };

    image.src = url;
  });
}

export async function readVideoDimensions(
  file: File
): Promise<MediaDimensions | null> {
  if (!file.type.startsWith("video/") || typeof document === "undefined") {
    return null;
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;

    const cleanup = () => {
      URL.revokeObjectURL(url);
      video.removeAttribute("src");
      video.load();
    };

    video.onloadedmetadata = () => {
      const dimensions =
        video.videoWidth > 0 && video.videoHeight > 0
          ? { width: video.videoWidth, height: video.videoHeight }
          : null;
      cleanup();
      resolve(dimensions);
    };

    video.onerror = () => {
      cleanup();
      resolve(null);
    };

    video.src = url;
  });
}

export async function readMediaDimensions(
  file: File
): Promise<MediaDimensions | null> {
  return file.type.startsWith("video/")
    ? readVideoDimensions(file)
    : readImageDimensions(file);
}

export async function optimizeImageForUpload(
  file: File,
  highQuality: boolean
): Promise<File> {
  if (
    highQuality ||
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height)
    );
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8)
    );

    if (!blob || blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "avenzo-image";
    return new File([blob], baseName + ".webp", {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}
