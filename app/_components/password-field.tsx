"use client";

import { useState } from "react";

export default function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
  minLength,
  label,
  error = "",
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  label?: string;
  error?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-wrap">
      {label && (
        <label className="auth-label" htmlFor={id}>
          {label}
        </label>
      )}
      <div className="password-control">
        <input
          id={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          required
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + "-error" : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
      {error && (
        <p className="auth-field-error" id={id + "-error"} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
