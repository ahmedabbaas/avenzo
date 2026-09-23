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
