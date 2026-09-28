"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import AuthBrandPanel from "../_components/auth-brand-panel";
import PasswordField from "../_components/password-field";
import TurnstileWidget, {
  readTurnstileToken,
  resetTurnstile,
} from "../_components/turnstile-widget";
import SiteFooter from "../_components/site-footer";
import { useRouter } from "next/navigation";
import AvatarImage from "../../features/social/components/avatar-image";
import {
  AVATAR_MAX_BYTES,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_PATTERN,
  isValidDisplayName,
  isValidEmail,
  isValidPassword,
  passwordValidationError,
  normalizeEmail,
  normalizeUsername,
} from "../../features/auth/validation";

const SERVICE_MESSAGE = "Account services are temporarily unavailable.";

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [available, setAvailable] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [usernameMessage, setUsernameMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [fullNameError, setFullNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [avatarError, setAvatarError] = useState("");
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  const passwordsMatch =
    confirmPassword.length > 0 && password === confirmPassword;

  const usernameState = useMemo(() => {
    if (!username) return "idle";
    if (!USERNAME_PATTERN.test(username)) return "invalid";
    if (checking) return "checking";
    if (available === true) return "available";
    if (available === false) return "taken";
    if (serviceUnavailable) return "offline";
    return "idle";
  }, [username, checking, available, serviceUnavailable]);

  useEffect(() => {
    if (!username || !USERNAME_PATTERN.test(username)) {
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setChecking(true);
      setUsernameMessage("");

      try {
        const response = await fetch(
          "/api/auth/username?username=" + encodeURIComponent(username),
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        const result = await response.json();

        if (!response.ok) {
          setAvailable(null);
          setServiceUnavailable(response.status === 503);
          setUsernameMessage("Unable to verify username availability right now.");
          return;
        }

        setServiceUnavailable(false);
        setAvailable(Boolean(result.available));
        setUsernameMessage(
          result.available
            ? "Username is available."
            : "This username is already taken. Please choose another one."
        );
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setAvailable(null);
        setServiceUnavailable(true);
        setUsernameMessage("Unable to verify username availability right now.");
      } finally {
        setChecking(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [username]);

  function changeUsername(value: string) {
    const clean = normalizeUsername(value);

    setUsername(clean);
    setAvailable(null);
    setServiceUnavailable(false);
    setFormMessage("");

    if (clean && !USERNAME_PATTERN.test(clean)) {
      setUsernameMessage(
        "Use 3–30 letters, numbers, underscores or periods."
      );
    } else {
      setUsernameMessage("");
    }
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] || null;

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    if (!file) {
      setAvatar(null);
      setAvatarPreview("");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setAvatarError("Profile picture must be an image.");
      event.target.value = "";
      return;
    }

    if (file.size > AVATAR_MAX_BYTES) {
      setAvatarError("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarError("");
    setFormMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormMessage("");
    setFullNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setAvatarError("");

    const cleanName = fullName.trim();
    const cleanEmail = normalizeEmail(email);

    if (!isValidDisplayName(cleanName)) {
      setFullNameError("Enter your full name.");
      return;
    }

    if (!USERNAME_PATTERN.test(username)) {
      setUsernameMessage(
        "Use 3–30 letters, numbers, underscores or periods."
      );
      return;
    }

    if (serviceUnavailable) {
      setUsernameMessage(SERVICE_MESSAGE);
      return;
    }

    if (available !== true) {
      setUsernameMessage(
        available === false
          ? "This username is already taken. Please choose another one."
          : "Wait for username availability to finish checking."
      );
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      setEmailError("Enter a valid email address.");
      return;
    }

    if (!isValidPassword(password)) {
      setPasswordError(passwordValidationError(password));
      return;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.set("fullName", cleanName);
      form.set("username", username);
      form.set("email", cleanEmail);
      form.set("password", password);
      form.set("confirmPassword", confirmPassword);
      if (avatar) form.set("avatar", avatar);
      form.set("turnstileToken", readTurnstileToken());

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        body: form,
      });

      const result = await response.json();

      if (!response.ok) {
        resetTurnstile();
        const message = result.error || "Unable to create your account.";

        if (response.status === 503) {
          setServiceUnavailable(true);
          setFormMessage(SERVICE_MESSAGE);
        } else if (result.field === "fullName") {
          setFullNameError(message);
        } else if (result.field === "username") {
          setAvailable(false);
          setUsernameMessage(message);
        } else if (result.field === "email") {
          setEmailError(message);
        } else if (result.field === "password") {
          setPasswordError(message);
        } else if (result.field === "confirmPassword") {
          setConfirmPasswordError(message);
        } else if (result.field === "avatar") {
          setAvatarError(message);
        } else {
          setFormMessage(message);
        }

        return;
      }

      if (result.requiresVerification) {
        router.replace("/login?registered=1");
      } else {
        router.replace("/home");
      }
    } catch {
      setServiceUnavailable(true);
      setFormMessage(SERVICE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const usernameHint =
    usernameState === "checking"
      ? "Checking username…"
      : usernameMessage ||
        "3–30 characters. Letters, numbers, underscores and periods only.";

  return (
    <main className="auth-shell">
      <div className="auth-glow auth-glow-a" />
      <div className="auth-glow auth-glow-b" />

      <AuthBrandPanel context="CREATE YOUR IDENTITY" />

      <section className="auth-card">
        <div className="eyebrow">JOIN AVENZO</div>
        <h1>Create your account.</h1>
        <p className="auth-sub">
          Your permanent username becomes your public identity across AVENZO.
        </p>

        <form className="auth-form" onSubmit={submit}>
          <label className="auth-label" htmlFor="signup-full-name">
            Full name
          </label>
          <input
            id="signup-full-name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value.slice(0, 80));
              setFullNameError("");
            }}
            placeholder="Full name"
            autoComplete="name"
            maxLength={DISPLAY_NAME_MAX_LENGTH}
            required
            aria-invalid={Boolean(fullNameError)}
            aria-describedby={fullNameError ? "signup-full-name-error" : undefined}
          />
          {fullNameError && (
            <p className="auth-field-error" id="signup-full-name-error" role="alert">
              {fullNameError}
            </p>
          )}

          <div>
            <label className="auth-label" htmlFor="signup-username">
              Username
            </label>
            <div className="username-control">
              <span>@</span>
              <input
                id="signup-username"
                value={username}
                onChange={(event) => changeUsername(event.target.value)}
                placeholder="username"
                autoComplete="username"
                maxLength={30}
                spellCheck={false}
                required
              />
            </div>

            <div className={"username-state " + usernameState}>
              <i aria-hidden="true" />
              <span>{usernameHint}</span>
            </div>
          </div>

          <label className="auth-label" htmlFor="signup-email">
            Email
          </label>
          <input
            id="signup-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setEmailError("");
              setFormMessage("");
            }}
            placeholder="Email"
            autoComplete="email"
            required
            aria-invalid={Boolean(emailError)}
            aria-describedby={emailError ? "signup-email-error" : undefined}
          />
          {emailError && (
            <p className="auth-field-error" id="signup-email-error" role="alert">
              {emailError}
            </p>
          )}

          <PasswordField
            id="new-password"
            value={password}
            onChange={(value) => {
              setPassword(value);
              setPasswordError("");
              setConfirmPasswordError("");
            }}
            placeholder="Password"
            autoComplete="new-password"
            minLength={8}
            label="Password"
            error={passwordError}
          />

          <PasswordField
            id="confirm-password"
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setConfirmPasswordError("");
            }}
            placeholder="Confirm password"
            autoComplete="new-password"
            minLength={8}
            label="Confirm password"
            error={confirmPasswordError}
          />

          <div className="password-hints">
            <span className={password.length >= 8 ? "done" : ""}>
              <i /> 8+ characters
            </span>
            <span className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "done" : ""}>
              <i /> Letter + number
            </span>
            <span className={passwordsMatch ? "done" : ""}>
              <i /> Passwords match
            </span>
          </div>

          <label className="auth-file">
            <span>
              Profile picture <small>optional, up to 5 MB</small>
            </span>
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>
          {avatarError && (
            <p className="auth-field-error" role="alert">{avatarError}</p>
          )}

          {avatarPreview && (
            <div className="signup-avatar-row">
              <AvatarImage
                className="signup-avatar-preview"
                src={avatarPreview}
                alt="Profile preview"
                size={156}
              />
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(avatarPreview);
                  setAvatar(null);
                  setAvatarPreview("");
                }}
              >
                Remove
              </button>
            </div>
          )}

          <TurnstileWidget action="signup" />

          {formMessage && (
            <div className="auth-message" role="status">
              {formMessage}
            </div>
          )}

          <button
            className="auth-submit"
            disabled={busy || checking}
          >
            {busy ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-links auth-links-center">
          <span>Already have an account?</span>
          <a href="/login">Login</a>
        </div>
      </section>
      <SiteFooter />
    </main>
  );
}
