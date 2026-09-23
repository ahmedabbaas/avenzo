"use client";

import { FormEvent, useState } from "react";
import AuthBrandPanel from "../_components/auth-brand-panel";
import PasswordField from "../_components/password-field";
import { createClient } from "../../lib/supabase/client";
import SiteFooter from "../_components/site-footer";
import { useRouter } from "next/navigation";

export default function ResetPasswordPage() {
  const router = useRouter();
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
      router.replace("/login?reset=1");
    } catch {
      setStatus("This reset session is invalid, expired, or unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <AuthBrandPanel context="SECURE RESET" />

      <section className="auth-card">
        <div className="eyebrow">NEW PASSWORD</div>
        <h1>Choose a new password.</h1>
        <p className="auth-sub">
          Use at least eight characters and choose something you do not reuse
          elsewhere.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <PasswordField
            id="new-password"
            value={password}
            onChange={setPassword}
            placeholder="New password"
            autoComplete="new-password"
            minLength={8}
          />

          <PasswordField
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirm new password"
            autoComplete="new-password"
            minLength={8}
          />

          {status && (
            <div className="auth-message" role="status">
              {status}
            </div>
          )}

          <button className="auth-submit" disabled={busy}>
            {busy ? "Updating…" : "Update Password"}
          </button>
        </form>
      </section>
      <SiteFooter />
    </main>
  );
}
