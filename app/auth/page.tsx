"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signup"|"login">("signup");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState<boolean|null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (error === "confirmation") setStatus("That confirmation link is invalid or expired.");
    if (error === "verify") setStatus("Verify your email before entering AVENZO.");
    if (error === "profile") setStatus("Your account profile could not be loaded. Please contact support.");
    if (error === "backend") setStatus("AVENZO backend is being configured. The app is online, but signup and login need the database connection.");
  }, []);

  function getSupabase() {
    return createClient();
  }

  async function checkUsername(value: string) {
    const clean = value.replace(/^@+/, "").toLowerCase();
    setUsername(clean);
    setAvailable(null);
    if (!/^[a-z0-9._]{3,24}$/.test(clean)) {
      if (clean) setStatus("Username must be 3–24 characters using letters, numbers, dots or underscores.");
      return;
    }
    setChecking(true);
    const { data, error } = await getSupabase().rpc("is_username_available", { candidate: clean });
    setChecking(false);
    if (error) {
      setStatus("Username check is temporarily unavailable.");
      return;
    }
    setAvailable(Boolean(data));
    setStatus(Boolean(data) ? "✓ Username available" : "Username already exists.");
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    if (mode === "signup") {
      if (!available || !username) {
        setStatus("Choose an available username first.");
        setBusy(false);
        return;
      }
      const { data, error } = await getSupabase().auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          emailRedirectTo: window.location.origin + "/auth/confirm",
          data: { username, display_name: name.trim() || "Avenzo User" }
        }
      });
      if (error) {
        setStatus(error.message.includes("USERNAME_TAKEN") ? "That username was just claimed. Choose another." : error.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setStatus("Account created. Check your email and verify your address before entering AVENZO.");
      }
    } else {
      const { error } = await getSupabase().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });
      if (error) {
        setStatus(error.message);
      } else {
        router.replace("/");
        router.refresh();
      }
    }
    setBusy(false);
  }

  async function resend() {
    if (!email) return;
    const { error } = await getSupabase().auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    setStatus(error ? error.message : "A fresh verification email has been sent.");
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
        <div className="eyebrow">PRIVATE SOCIAL NETWORK</div>
        <h1>{mode === "signup" ? "Create your AVENZO account." : "Welcome back."}</h1>
        <p className="auth-sub">One real account. One unique username. Your identity stays yours.</p>

        <div className="auth-tabs">
          <button className={mode === "signup" ? "selected" : ""} onClick={() => {setMode("signup");setStatus("");}}>Create account</button>
          <button className={mode === "login" ? "selected" : ""} onClick={() => {setMode("login");setStatus("");}}>Sign in</button>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" autoComplete="name" required />}
          {mode === "signup" && (
            <div>
              <input value={username} onChange={e=>checkUsername(e.target.value)} placeholder="@username" autoComplete="username" required />
              <div className={"username-state " + (available ? "ok" : "")}>{checking ? "Checking…" : (status || "Your username becomes your permanent AVENZO identity.")}</div>
            </div>
          )}
          <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required />
          <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" autoComplete={mode==="signup"?"new-password":"current-password"} minLength={8} required />

          {mode === "signup" && <p className="auth-note">Email verification is required before your account can enter AVENZO. Automated/fake accounts can be reduced further with CAPTCHA in production.</p>}

          {status && mode === "login" && <div className="auth-message">{status}</div>}
          {status && mode === "signup" && available !== true && <div className="auth-message">{status}</div>}

          <button className="auth-submit" disabled={busy}>{busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}</button>
          {mode === "signup" && status.startsWith("Account created") && <button type="button" className="resend" onClick={resend}>Resend verification email</button>}
        </form>

        <p className="auth-foot">By joining AVENZO you agree to the platform rules and privacy policy.</p>
      </section>
    </main>
  );
}
