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
        viewBox="0 0 32 32"
        aria-hidden="true"
        focusable="false"
      >
        <path
          className="verified-badge-seal"
          d="M16 1.5c1.8 0 3 2.05 4.55 2.48 1.62.45 3.5-.72 4.82.27 1.35 1.02.83 3.17 1.8 4.54.96 1.36 3.18 1.66 3.18 3.41s-2.22 2.05-3.18 3.41c-.97 1.37-.45 3.52-1.8 4.54-1.32.99-3.2-.18-4.82.27C19 20.85 17.8 22.9 16 22.9s-3-2.05-4.55-2.48c-1.62-.45-3.5.72-4.82-.27-1.35-1.02-.83-3.17-1.8-4.54-.96-1.36-3.18-1.66-3.18-3.41s2.22-2.05 3.18-3.41c.97-1.37.45-3.52 1.8-4.54 1.32-.99 3.2.18 4.82-.27C13 3.55 14.2 1.5 16 1.5Z" transform="translate(0 3.55) scale(1 .98)"
        />
        <path
          className="verified-badge-check"
          d="m9.2 16.3 4.25 4.2 9.35-9.4"
        />
      </svg>
    </span>
  );
}
