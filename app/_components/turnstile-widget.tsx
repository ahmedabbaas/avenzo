"use client";

import Script from "next/script";

declare global {
  interface Window {
    turnstile?: {
      reset: (widgetId?: string) => void;
    };
  }
}

export function readTurnstileToken() {
  if (typeof document === "undefined") return "";

  const input = document.querySelector<HTMLInputElement>(
    'input[name="cf-turnstile-response"]'
  );

  return input?.value || "";
}

export function resetTurnstile() {
  if (typeof window !== "undefined") {
    window.turnstile?.reset();
  }
}

export default function TurnstileWidget({
  action,
}: {
  action: "login" | "signup" | "password_reset";
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!siteKey) return null;

  return (
    <div className="turnstile-wrap">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js"
        strategy="afterInteractive"
      />
      <div
        className="cf-turnstile"
        data-sitekey={siteKey}
        data-theme="dark"
        data-size="flexible"
        data-appearance="interaction-only"
        data-action={action}
      />
    </div>
  );
}
