import Image from "next/image";

export default function AvatarImage({
  src,
  alt,
  className,
  size = 96,
}: {
  src: string;
  alt: string;
  className?: string;
  size?: number;
}) {
  const unoptimized =
    src.startsWith("data:") ||
    src.startsWith("blob:");

  return (
    <Image
      src={src}
      alt={alt}
      width={size}
      height={size}
      className={className}
      unoptimized={unoptimized}
    />
  );
}
