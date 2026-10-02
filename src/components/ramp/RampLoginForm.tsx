"use client";

import { useState } from "react";

/** The Ramp design around the application's real Supabase magic-link flow. */
export function RampLoginForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) {
      setError("Enter your email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to send a sign-in link.");
      setSent(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send a sign-in link.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) return <p className="rampNote">Check <strong>{email}</strong> for your sign-in link.</p>;

  return (
    <form className="rampForm" onSubmit={submit} noValidate>
      <div className={`rampField${error ? " rampFieldError" : ""}`}>
        <input
          type="email"
          name="email"
          autoComplete="email"
          aria-label="Email address"
          aria-invalid={error ? true : undefined}
          placeholder="Email address *"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError(null);
          }}
        />
      </div>
      {error && <p className="rampError" role="alert">{error}</p>}
      <button className="rampSubmit" type="submit" disabled={submitting}>
        {submitting ? "Sending…" : "Continue"}
      </button>
      <div className="rampFormFooter" />
    </form>
  );
}
