"use client";

import { useState } from "react";

export function AdminLogin({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/ramp-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "That password is not correct.");
        setSubmitting(false);
        return;
      }
      window.location.reload();
    } catch {
      setError("Unable to sign in.");
      setSubmitting(false);
    }
  }

  return (
    <div className="rampAuth">
      <div className="rampAuthInner">
        <h1>Configuration</h1>
        {configured ? (
          <form className="rampForm" onSubmit={submit}>
            <div className={`rampField${error ? " rampFieldError" : ""}`}>
              <input
                type="password"
                autoComplete="current-password"
                aria-label="Admin password"
                placeholder="Password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (error) setError(null);
                }}
              />
            </div>
            {error && <p className="rampError" role="alert">{error}</p>}
            <button className="rampSubmit" type="submit" disabled={submitting || !password}>
              {submitting ? "Checking…" : "Continue"}
            </button>
          </form>
        ) : (
          <p className="rampNote">
            Set <code>RAMP_ADMIN_PASSWORD</code> in <code>.env.local</code> and restart the server to
            enable this page.
          </p>
        )}
      </div>
    </div>
  );
}
