import Image from "next/image";
import type { MouseEventHandler } from "react";

export default function UserMediaImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
  onClick,
  dataAvenzoPostId,
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  className?: string;
  loading?: "eager" | "lazy";
  onClick?: MouseEventHandler<HTMLImageElement>;
  dataAvenzoPostId?: string;
}) {
  const hasDimensions =
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    Number(width) > 0 &&
    Number(height) > 0;

  const requiresNativeImage =
    !hasDimensions ||
    src.startsWith("blob:") ||
    src.startsWith("data:");

  if (requiresNativeImage) {
    // Legacy media may predate stored dimensions and local previews use blob URLs.
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        onClick={onClick}
        data-avenzo-post-id={dataAvenzoPostId}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={Number(width)}
      height={Number(height)}
      className={className}
      loading={loading}
      onClick={onClick}
      data-avenzo-post-id={dataAvenzoPostId}
      sizes="(max-width: 780px) 100vw, 720px"
    />
  );
}
