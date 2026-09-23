"use client";

import { FormEvent, useEffect, useState } from "react";
import AuthBrandPanel from "../_components/auth-brand-panel";
import PasswordField from "../_components/password-field";

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");

    if (error === "verify") setStatus("Verify your email before signing in.");
    if (error === "profile") setStatus("Your profile could not be loaded.");
    if (error === "confirmation") {
      setStatus("That confirmation link is invalid or expired.");
    }
    if (error === "backend") {
      setStatus("Account services are temporarily unavailable.");
    }
    if (params.get("registered") === "1") {
      setStatus("Account created. Check your email, then sign in.");
    }
    if (params.get("reset") === "1") {
      setStatus("Password updated. Sign in with your new password.");
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setStatus(
          response.status === 503
            ? "Account services are temporarily unavailable."
            : result.error || "Unable to sign in."
        );
        return;
      }

      window.location.assign("/home");
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

      <AuthBrandPanel context="WELCOME TO AVENZO" />

      <section className="auth-card">
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Sign in.</h1>
        <p className="auth-sub">
          Your feed, conversations and profile stay behind your account.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label" htmlFor="identifier">
            Username or email
          </label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Username or email"
            autoComplete="username"
            spellCheck={false}
            required
          />

          <PasswordField
            id="password"
            label="Password"
            value={password}
            onChange={setPassword}
            placeholder="Password"
            autoComplete="current-password"
          />

          <div className="auth-links">
            <a href="/forgot-password">Forgot Password?</a>
          </div>

          {status && (
            <div className="auth-message" role="status">
              {status}
            </div>
          )}

          <button className="auth-submit" disabled={busy || !identifier.trim() || !password}>
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <p className="auth-session-note">
          Your session stays signed in on this device until you sign out.
        </p>

        <div className="auth-divider">
          <span>New to AVENZO?</span>
        </div>

        <a className="auth-secondary-button" href="/signup">
          Create Account
        </a>
      </section>
    </main>
  );
}
