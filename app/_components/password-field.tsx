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
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  autoComplete: string;
  minLength?: number;
  label?: string;
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
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
