import Image from "next/image";

export default function UserMediaImage({
  src,
  alt,
  width,
  height,
  className,
  loading = "lazy",
}: {
  src: string;
  alt: string;
  width?: number | null;
  height?: number | null;
  className?: string;
  loading?: "eager" | "lazy";
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
    return <img src={src} alt={alt} className={className} loading={loading} />;
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={Number(width)}
      height={Number(height)}
      className={className}
      loading={loading}
      sizes="(max-width: 780px) 100vw, 720px"
    />
  );
}
