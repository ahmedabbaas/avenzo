"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
const SERVICE_MESSAGE = "Account services are temporarily unavailable. Please try again shortly.";

export default function SignupPage() {
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
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!username || !USERNAME_PATTERN.test(username)) {
      setAvailable(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setChecking(true);
      setUsernameMessage("");

      try {
        const response = await fetch("/api/auth/username?username=" + encodeURIComponent(username));
        const result = await response.json();

        if (!response.ok) {
          setAvailable(null);
          if (response.status === 503) {
            setServiceUnavailable(true);
            setUsernameMessage("Unable to check username availability right now.");
          } else {
            setUsernameMessage("Unable to check username availability right now.");
          }
          return;
        }

        setServiceUnavailable(false);
        setAvailable(Boolean(result.available));
        setUsernameMessage(
          result.available
            ? "Username is available."
            : "This username is already taken. Please choose another one."
        );
      } catch {
        setAvailable(null);
        setServiceUnavailable(true);
        setUsernameMessage("");
      } finally {
        setChecking(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [username]);

  function changeUsername(value: string) {
    const clean = value.replace(/^@+/, "").toLowerCase();
    setUsername(clean);
    setAvailable(null);
    setFormMessage("");

    if (clean && !USERNAME_PATTERN.test(clean)) {
      setUsernameMessage("Username must be 3–30 characters using letters, numbers, underscores or periods.");
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
      setFormMessage("Profile picture must be an image.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setFormMessage("Profile picture must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    setAvatar(file);
    setAvatarPreview(URL.createObjectURL(file));
    setFormMessage("");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setFormMessage("");

    if (!fullName.trim() || fullName.trim().length > 80) {
      setFormMessage("Enter a valid full name.");
      return;
    }
    if (!USERNAME_PATTERN.test(username)) {
      setFormMessage("Username must be 3–30 characters using letters, numbers, underscores or periods.");
      return;
    }
    if (serviceUnavailable) {
      setFormMessage(SERVICE_MESSAGE);
      return;
    }
    if (available !== true) {
      setFormMessage(
        available === false
          ? "This username is already taken. Please choose another one."
          : "Wait for username availability to finish checking."
      );
      return;
    }
    if (password.length < 8) {
      setFormMessage("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormMessage("Passwords do not match.");
      return;
    }

    setBusy(true);

    try {
      const form = new FormData();
      form.set("fullName", fullName.trim());
      form.set("username", username);
      form.set("email", email.trim().toLowerCase());
      form.set("password", password);
      form.set("confirmPassword", confirmPassword);
      if (avatar) form.set("avatar", avatar);

      const response = await fetch("/api/auth/signup", { method: "POST", body: form });
      const result = await response.json();

      if (!response.ok) {
        if (response.status === 503) {
          setServiceUnavailable(true);
          setFormMessage(SERVICE_MESSAGE);
        } else {
          setFormMessage(result.error || "Unable to create your account.");
        }

        if (response.status === 409) setAvailable(false);
        return;
      }

      if (result.requiresVerification) {
        window.location.assign("/login?registered=1");
      } else {
        window.location.assign("/home");
      }
    } catch {
      setServiceUnavailable(true);
      setFormMessage(SERVICE_MESSAGE);
    } finally {
      setBusy(false);
    }
  }

  const usernameHint =
    checking
      ? "Checking username…"
      : usernameMessage ||
        "3–30 characters. Letters, numbers, underscores and periods only.";

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
        <div className="eyebrow">CREATE YOUR IDENTITY</div>
        <h1>Create your account.</h1>
        <p className="auth-sub">Your username is unique across AVENZO and becomes your public identifier.</p>

                <form className="auth-form" onSubmit={submit}>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" autoComplete="name" maxLength={80} required />

          <div>
            <input value={username} onChange={(e) => changeUsername(e.target.value)} placeholder="@username" autoComplete="username" maxLength={30} required />
            {usernameHint && (
              <div className={"username-state " + (available ? "ok" : available === false ? "bad" : "")}>
                {usernameHint}
              </div>
            )}
          </div>

          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" required />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" autoComplete="new-password" minLength={8} required />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" autoComplete="new-password" minLength={8} required />

          <label className="auth-file">
            <span>Profile picture <small>optional, up to 5 MB</small></span>
            <input type="file" accept="image/*" onChange={chooseAvatar} />
          </label>

          {avatarPreview && <img className="signup-avatar-preview" src={avatarPreview} alt="Profile preview" />}
          {formMessage && <div className="auth-message">{formMessage}</div>}

          <button className="auth-submit" disabled={busy || checking}>
            {busy ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <div className="auth-links auth-links-center">
          <span>Already have an account?</span>
          <a href="/login">Login</a>
        </div>
      </section>
    </main>
  );
}
