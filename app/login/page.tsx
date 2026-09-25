"use client";

import { FormEvent, useEffect, useState } from "react";
import PasswordField from "../_components/password-field";
import BrandLogo from "../../components/brand-logo";
import Icon from "../../features/social/components/icon";
import TurnstileWidget, {
  readTurnstileToken,
  resetTurnstile,
} from "../_components/turnstile-widget";
import SiteFooter from "../_components/site-footer";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    let nextStatus = "";

    if (error === "verify") nextStatus = "Verify your email before signing in.";
    if (error === "profile") nextStatus = "Your profile could not be loaded.";
    if (error === "confirmation") {
      nextStatus = "That confirmation link is invalid or expired.";
    }
    if (error === "backend") {
      nextStatus = "Account services are temporarily unavailable.";
    }
    if (params.get("registered") === "1") {
      nextStatus = "Account created. Check your email, then sign in.";
    }
    if (params.get("reset") === "1") {
      nextStatus = "Password updated. Sign in with your new password.";
    }
    if (params.get("deleted") === "1") {
      nextStatus = "Your AVENZO account has been deleted.";
    }
    const needsMfa = params.get("mfa") === "1";
    if (needsMfa) {
      nextStatus = "Enter your authenticator code to finish signing in.";
    }

    if (!nextStatus && !needsMfa) return;
    const timer = window.setTimeout(() => {
      if (needsMfa) setMfaRequired(true);
      if (nextStatus) setStatus(nextStatus);
    }, 0);
    return () => window.clearTimeout(timer);
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
          turnstileToken: readTurnstileToken(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        resetTurnstile();
        setStatus(
          response.status === 503
            ? "Account services are temporarily unavailable."
            : result.error || "Unable to sign in."
        );
        return;
      }

      if (result.requiresMfa) {
        setMfaRequired(true);
        setStatus("Enter your authenticator code to finish signing in.");
        return;
      }

      router.replace("/home");
    } catch {
      setStatus("Unable to reach AVENZO right now.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyMfa(event: FormEvent) {
    event.preventDefault();

    if (mfaCode.length !== 6) {
      setStatus("Enter the 6-digit authenticator code.");
      return;
    }

    setBusy(true);
    setStatus("");

    try {
      const response = await fetch("/api/auth/mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode }),
      });
      const result = await response.json();

      if (!response.ok) {
        setStatus(result.error || "Unable to verify authenticator code.");
        return;
      }

      router.replace("/home");
      router.refresh();
    } catch {
      setStatus("Unable to verify two-factor authentication right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell login-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <section className="login-showcase-card" aria-label="About AVENZO">
        <div className="login-showcase-icons" aria-hidden="true">
          <span><Icon name="heart" size={28} /></span>
          <span><Icon name="plus" size={31} /></span>
          <span><Icon name="camera" size={28} /></span>
          <span><Icon name="messages" size={28} /></span>
          <span><Icon name="activity" size={28} /></span>
          <span><Icon name="search" size={28} /></span>
        </div>

        <div className="login-showcase-brand">
          <BrandLogo size={62} priority />
          <div>
            <strong>AVENZO</strong>
            <span>Connect. Share. Belong.</span>
          </div>
        </div>

        <p>
          Sign in to your real feed, conversations, stories and people.
          No demo accounts. No fake activity.
        </p>

        <a className="login-showcase-cta" href="/signup">
          Create your account
        </a>
      </section>

      <section className="auth-card login-card">
        <div className="login-card-visual" aria-hidden="true">
          <span><Icon name="saved" size={28} /></span>
          <span><Icon name="profile" size={28} /></span>
          <span><Icon name="messages" size={28} /></span>
        </div>

        <div className="login-card-brand">
          <BrandLogo size={38} priority />
          <strong>AVENZO</strong>
        </div>
        <div className="eyebrow">
          {mfaRequired ? "TWO-FACTOR AUTHENTICATION" : "WELCOME BACK"}
        </div>
        <h1>{mfaRequired ? "Verify your sign-in." : "Let’s sign you in."}</h1>
        <p className="auth-sub">
          {mfaRequired
            ? "Enter the 6-digit code from your authenticator app."
            : "Welcome back. Your AVENZO world has been waiting for you."}
        </p>

        <form
          className="auth-form"
          onSubmit={mfaRequired ? verifyMfa : submit}
        >
          {mfaRequired ? (
            <label className="auth-label" htmlFor="mfa-code">
              Authenticator code
              <input
                id="mfa-code"
                value={mfaCode}
                onChange={(event) =>
                  setMfaCode(
                    event.target.value.replace(/\D/g, "").slice(0, 6)
                  )
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                required
              />
            </label>
          ) : (
            <>
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
              
              
            </>
          )}

          {!mfaRequired && (
            <>
              <div className="auth-links">
                <a href="/forgot-password">Forgot Password?</a>
              </div>
              <TurnstileWidget action="login" />
            </>
          )}

          {status && (
            <div className="auth-message" role="status">
              {status}
            </div>
          )}

          <button
            className="auth-submit"
            disabled={
              busy ||
              (mfaRequired
                ? mfaCode.length !== 6
                : !identifier.trim() || !password)
            }
          >
            {busy
              ? "Please wait…"
              : mfaRequired
                ? "Verify & Continue"
                : "Sign in"}
          </button>

          {mfaRequired && (
            <button
              type="button"
              className="auth-secondary-button"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
                setMfaRequired(false);
                setMfaCode("");
                setStatus("");
              }}
            >
              Back to password login
            </button>
          )}
        </form>

        <p className="auth-session-note">
          Your session stays signed in on this device until you sign out.
        </p>

        <div className="auth-divider">
          <span>Don’t have an account?</span>
        </div>

        <a className="auth-secondary-button login-register-button" href="/signup">
          Register
        </a>
      </section>
      <SiteFooter />
    </main>
  );
}
