import Image from "next/image";

export default function BrandLogo({
  size = 32,
  className = "",
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/avenzo-logo.webp"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={"avenzo-brand-logo " + className}
    />
  );
}
