"use client";

import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      setStatus(result.message || result.error || "If that email exists, a reset link has been sent.");
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

      <section className="auth-brand">
        <span className="brand-mark">A</span>
        <div>
          <strong>AVENZO</strong>
          <span>Account recovery</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="eyebrow">RECOVER ACCESS</div>
        <h1>Reset your password.</h1>
        <p className="auth-sub">Enter the email linked to your account. We’ll send a secure reset link.</p>

        <form className="auth-form" onSubmit={submit}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required />
          {status && <div className="auth-message">{status}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? "Sending…" : "Send Reset Link"}</button>
        </form>

        <div className="auth-links auth-links-center">
          <a href="/login">Back to Login</a>
        </div>
      </section>
    </main>
  );
}
