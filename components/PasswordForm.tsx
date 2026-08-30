"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";

export function PasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const email = String(fd.get("email") ?? "").trim().toLowerCase();
        const password = String(fd.get("password") ?? "");
        setError(null);
        start(async () => {
          const res = await signIn("credentials", { email, password, redirect: false });
          if (!res || res.error) {
            setError(
              res?.status === 500
                ? "Sign-in is misconfigured on the server. Try again shortly."
                : "That email and password don’t match.",
            );
            return;
          }
          window.location.href = "/feed";
        });
      }}
    >
      {error && (
        <p className="card p-3 text-sm" style={{ borderLeft: "3px solid var(--earth)" }}>
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1">
        <span className="label">Email</span>
        <input name="email" type="email" required className="field" autoComplete="email" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="label">Password</span>
        <input name="password" type="password" required className="field" autoComplete="current-password" />
      </label>
      <button type="submit" disabled={pending} className="btn ghost">
        {pending ? "Signing in…" : "Sign in with password"}
      </button>
    </form>
  );
}
