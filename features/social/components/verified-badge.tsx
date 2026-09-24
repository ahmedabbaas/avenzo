export default function VerifiedBadge({
  verified,
  className = "",
}: {
  verified?: boolean;
  className?: string;
}) {
  if (!verified) return null;

  return (
    <span
      className={"verified-badge " + className}
      title="Verified account"
      aria-label="Verified account"
    >
      ✓
    </span>
  );
}
