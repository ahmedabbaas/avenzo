"use client";

import { FormEvent, useState } from "react";
import AuthBrandPanel from "../_components/auth-brand-panel";
import TurnstileWidget, {
  readTurnstileToken,
  resetTurnstile,
} from "../_components/turnstile-widget";
import SiteFooter from "../_components/site-footer";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          turnstileToken: readTurnstileToken(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        resetTurnstile();
        setStatus(
          response.status === 503
            ? "Account services are temporarily unavailable."
            : result.error || "Unable to send a reset link."
        );
        return;
      }

      setSent(true);
      setStatus(
        result.message ||
          "If an account exists for that email, a reset link has been sent."
      );
    } catch {
      setStatus("Unable to reach AVENZO right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <AuthBrandPanel context="ACCOUNT RECOVERY" />

      <section className="auth-card">
        <div className="eyebrow">RECOVER ACCESS</div>
        <h1>Reset your password.</h1>
        <p className="auth-sub">
          Enter the email linked to your account. We’ll send a secure reset
          link if the account exists.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            autoComplete="email"
            required
          />

          <TurnstileWidget action="password_reset" />

          {status && (
            <div className="auth-message" role="status">
              {status}
            </div>
          )}

          <button className="auth-submit" disabled={busy || sent}>
            {busy ? "Sending…" : sent ? "Reset link sent" : "Send Reset Link"}
          </button>
        </form>

        <div className="auth-links auth-links-center">
          <a href="/login">Back to Login</a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
