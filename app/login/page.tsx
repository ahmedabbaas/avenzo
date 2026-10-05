"use client";

import { FormEvent, useEffect, useState } from "react";
import ThemeSwitch from "../../components/theme-switch";
import PasswordField from "../_components/password-field";
import BrandLogo from "../../components/brand-logo";
import Icon from "../../features/social/components/icon";
import TurnstileWidget, {
  readTurnstileToken,
  resetTurnstile,
} from "../_components/turnstile-widget";
import SiteFooter from "../_components/site-footer";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isValidEmail } from "../../features/auth/validation";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [identifierError, setIdentifierError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
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
    if (error === "session") {
      nextStatus = "Your session expired. Sign in again to continue.";
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
    setStatus("");
    setIdentifierError("");
    setPasswordError("");

    const cleanIdentifier = identifier.trim();

    if (!cleanIdentifier) {
      setIdentifierError("Enter your username or email.");
      return;
    }

    if (cleanIdentifier.includes("@") && !isValidEmail(cleanIdentifier)) {
      setIdentifierError("Enter a valid email address.");
      return;
    }

    if (!password) {
      setPasswordError("Enter your password.");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: cleanIdentifier,
          password,
          rememberSession,
          turnstileToken: readTurnstileToken(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        resetTurnstile();
        const message =
          response.status === 503
            ? "Account services are temporarily unavailable."
            : result.error || "Unable to sign in.";

        if (result.field === "identifier") {
          setIdentifierError(message);
        } else if (result.field === "password" || result.field === "credentials") {
          setPasswordError(message);
        } else {
          setStatus(message);
        }
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
    <main className="auth-shell login-shell login-reference-shell">
      <div className="premium-login-tools"><ThemeSwitch /></div>

      <section className="auth-card login-card login-reference-card">
        <header className="login-reference-hero">
          <div className="login-reference-topbar">
            <Link className="login-reference-brand" href="/" aria-label="AVENZO home">
              <BrandLogo size={100} priority />
              <span>AVENZO</span>
            </Link>
            {!mfaRequired && (
              <Link className="login-reference-signup" href="/signup">
                <Icon name="userPlus" size={15} />
                <span>Sign Up</span>
              </Link>
            )}
          </div>

          <div className="login-reference-heading">
            <span className="login-reference-kicker">
              {mfaRequired ? "SECURE ACCESS" : "YOUR SPACE. YOUR PEOPLE."}
            </span>
            <h1>{mfaRequired ? "Verify your identity." : "Welcome back."}</h1>
            <p>
              {mfaRequired
                ? "Confirm your identity to continue."
                : "Sign in and pick up where you left off."}
            </p>
          </div>
        </header>

        <div className="login-reference-body">
          <form
            className="auth-form login-reference-form"
            onSubmit={mfaRequired ? verifyMfa : submit}
          >
            {mfaRequired ? (
              <label className="auth-label login-reference-field" htmlFor="mfa-code">
                <span>Authenticator code</span>
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
                <label className="auth-label login-reference-field" htmlFor="identifier">
                  <span>Email or username</span>
                  <input
                    id="identifier"
                    value={identifier}
                    onChange={(event) => {
                      setIdentifier(event.target.value);
                      setIdentifierError("");
                      setStatus("");
                    }}
                    placeholder="you@example.com"
                    autoComplete="username"
                    spellCheck={false}
                    required
                    aria-invalid={Boolean(identifierError)}
                    aria-describedby={identifierError ? "identifier-error" : undefined}
                  />
                </label>

                {identifierError && (
                  <p className="auth-field-error" id="identifier-error" role="alert">
                    {identifierError}
                  </p>
                )}

                <PasswordField
                  id="password"
                  label="Password"
                  value={password}
                  onChange={(value) => {
                    setPassword(value);
                    setPasswordError("");
                    setStatus("");
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  error={passwordError}
                />

                <div className="auth-login-options login-reference-options">
                  <label className="auth-remember">
                    <input
                      type="checkbox"
                      checked={rememberSession}
                      onChange={(event) => setRememberSession(event.target.checked)}
                    />
                    <span>Remember me</span>
                  </label>
                  <Link href="/forgot-password">Forgot password?</Link>
                </div>

                <TurnstileWidget action="login" />
              </>
            )}

            {status && (
              <div className="auth-message login-reference-message" role="status">
                {status}
              </div>
            )}

            <button
              className="auth-submit login-reference-submit"
              disabled={
                busy ||
                (mfaRequired
                  ? mfaCode.length !== 6
                  : !identifier.trim() || !password)
              }
            >
              <span className="login-reference-submit-icon" aria-hidden="true">
                <Icon name={mfaRequired ? "shield" : "send"} size={16} />
              </span>
              <span>
                {busy
                  ? "Please wait..."
                  : mfaRequired
                    ? "Verify & Continue"
                    : "Sign In"}
              </span>
            </button>

            {mfaRequired && (
              <button
                type="button"
                className="auth-secondary-button login-reference-back"
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

          {!mfaRequired && (
            <>
              <div className="login-reference-divider">
                <span>New to AVENZO?</span>
              </div>

              <Link className="login-reference-register" href="/signup">
                Create account
              </Link>
            </>
          )}

          <p className="login-reference-session-note">
            {mfaRequired
              ? "Two-factor verification protects your account."
              : rememberSession
                ? "This device stays signed in until you sign out or the session expires."
                : "This sign-in is limited to the current browser session."}
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
