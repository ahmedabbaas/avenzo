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
      <svg
        viewBox="0 0 24 24"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="verified-badge-seal"
          d="M12 1.7c1.1 0 1.8 1.2 2.8 1.5 1 .3 2.2-.4 3 .2.9.6.6 2 .9 2.9.3 1 1.6 1.6 1.6 2.7 0 1.1-1.3 1.8-1.6 2.8-.3 1 .4 2.2-.4 3-.6.9-2 .6-2.9.9-1 .3-1.6 1.6-2.7 1.6-1.1 0-1.8-1.3-2.8-1.6-1-.3-2.2.4-3-.4-.9-.6-.6-2-.9-2.9-.3-1-1.6-1.6-1.6-2.7 0-1.1 1.3-1.8 1.6-2.8.3-1-.4-2.2.4-3 .6-.9 2-.6 2.9-.9 1-.3 1.6-1.5 2.7-1.5Z"
        />
        <path
          className="verified-badge-check"
          d="m7.4 12.2 3 3.1 6.4-6.8"
        />
      </svg>
    </span>
  );
}
