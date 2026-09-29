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
    !file.type.startsWith("image/") ||
    file.type === "image/gif" ||
    typeof document === "undefined"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    // "High quality" should preserve detail, not blindly upload a 20+ MB
    // camera original. Mobile uploads are much more reliable when huge
    // images are resized before they touch the network.
    const maxDimension = highQuality ? 2560 : 1600;
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
      canvas.toBlob(resolve, "image/webp", highQuality ? 0.9 : 0.8)
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


export type PostImageCrop = "original" | "square" | "portrait" | "landscape";
export type PostImageFilter = "none" | "vivid" | "warm" | "cool" | "mono";

export type PostImageEditOptions = {
  crop: PostImageCrop;
  rotation: 0 | 90 | 180 | 270;
  filter: PostImageFilter;
  brightness: number;
  contrast: number;
};

function centeredCrop(
  width: number,
  height: number,
  crop: PostImageCrop
) {
  if (crop === "original") {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }

  const targetRatio =
    crop === "square" ? 1 : crop === "portrait" ? 4 / 5 : 16 / 9;
  const sourceRatio = width / height;

  if (sourceRatio > targetRatio) {
    const sw = Math.round(height * targetRatio);
    return {
      sx: Math.round((width - sw) / 2),
      sy: 0,
      sw,
      sh: height,
    };
  }

  const sh = Math.round(width / targetRatio);
  return {
    sx: 0,
    sy: Math.round((height - sh) / 2),
    sw: width,
    sh,
  };
}

export async function editPostImage(
  file: File,
  options: PostImageEditOptions
): Promise<{ file: File; dimensions: MediaDimensions }> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only images can be edited.");
  }

  if (typeof document === "undefined" || typeof createImageBitmap !== "function") {
    throw new Error("Image editing is not supported on this device.");
  }

  const bitmap = await createImageBitmap(file);

  try {
    const crop = centeredCrop(bitmap.width, bitmap.height, options.crop);
    const sideways = options.rotation === 90 || options.rotation === 270;
    const canvas = document.createElement("canvas");
    canvas.width = sideways ? crop.sh : crop.sw;
    canvas.height = sideways ? crop.sw : crop.sh;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not start the image editor.");

    const brightness = Math.max(50, Math.min(150, options.brightness));
    const contrast = Math.max(50, Math.min(150, options.contrast));
    const filterParts = [
      `brightness(${brightness}%)`,
      `contrast(${contrast}%)`,
    ];

    if (options.filter === "vivid") filterParts.push("saturate(135%)");
    if (options.filter === "mono") filterParts.push("grayscale(100%)");
    if (options.filter === "warm") filterParts.push("saturate(112%) sepia(10%)");
    if (options.filter === "cool") filterParts.push("saturate(105%) contrast(103%)");

    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((options.rotation * Math.PI) / 180);
    context.filter = filterParts.join(" ");
    context.drawImage(
      bitmap,
      crop.sx,
      crop.sy,
      crop.sw,
      crop.sh,
      -crop.sw / 2,
      -crop.sh / 2,
      crop.sw,
      crop.sh
    );
    context.restore();

    if (options.filter === "warm" || options.filter === "cool") {
      context.save();
      context.globalCompositeOperation = "soft-light";
      context.globalAlpha = 0.08;
      context.fillStyle =
        options.filter === "warm" ? "rgb(255, 128, 48)" : "rgb(70, 145, 255)";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.restore();
    }

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.92)
    );
    if (!blob) throw new Error("Could not export the edited image.");

    const baseName = file.name.replace(/\.[^.]+$/, "") || "avenzo-post";
    return {
      file: new File([blob], baseName + "-edited.webp", {
        type: "image/webp",
        lastModified: Date.now(),
      }),
      dimensions: {
        width: canvas.width,
        height: canvas.height,
      },
    };
  } finally {
    bitmap.close();
  }
}
