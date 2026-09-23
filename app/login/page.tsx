"use client";

import { FormEvent, useEffect, useState } from "react";

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
    if (error === "confirmation") setStatus("That confirmation link is invalid or expired.");
    if (error === "backend") setStatus("Account services are temporarily unavailable. Please try again shortly.");
    if (params.get("registered") === "1") setStatus("Account created. Check your email, then sign in.");
    if (params.get("reset") === "1") setStatus("Password updated. Sign in with your new password.");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(response.status === 503 ? "Account services are temporarily unavailable. Please try again shortly." : (result.error || "Unable to sign in."));
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

      <section className="auth-brand">
        <span className="brand-mark">A</span>
        <div>
          <strong>AVENZO</strong>
          <span>Connect. Share. Belong.</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="eyebrow">WELCOME BACK</div>
        <h1>Sign in to AVENZO.</h1>
        <p className="auth-sub">Your feed, conversations and people stay behind your account.</p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label" htmlFor="identifier">Username or email</label>
          <input
            id="identifier"
            value={identifier}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="Username or email"
            autoComplete="username"
            required
          />

          <label className="auth-label" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            required
          />

          <div className="auth-links">
            <a href="/forgot-password">Forgot Password?</a>
          </div>

          {status && <div className="auth-message">{status}</div>}

          <button className="auth-submit" disabled={busy}>
            {busy ? "Signing in…" : "Login"}
          </button>
        </form>

        <div className="auth-divider"><span>New to AVENZO?</span></div>
        <a className="auth-secondary-button" href="/signup">Create Account</a>
      </section>
    </main>
  );
}
