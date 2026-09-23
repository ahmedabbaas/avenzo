"use client";

import { FormEvent, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setStatus("");

    if (password.length < 8) {
      setStatus("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setStatus("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setStatus(error.message);
        return;
      }

      await supabase.auth.signOut();
      window.location.assign("/login?reset=1");
    } catch {
      setStatus("Your reset session is invalid, expired, or the backend is not configured.");
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
          <span>Secure password reset</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="eyebrow">NEW PASSWORD</div>
        <h1>Choose a new password.</h1>
        <form className="auth-form" onSubmit={submit}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" autoComplete="new-password" minLength={8} required />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm new password" autoComplete="new-password" minLength={8} required />
          {status && <div className="auth-message">{status}</div>}
          <button className="auth-submit" disabled={busy}>{busy ? "Updating…" : "Update Password"}</button>
        </form>
      </section>
    </main>
  );
}
