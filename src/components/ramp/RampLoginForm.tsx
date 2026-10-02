"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// Frontend only for now: the simulator's real session still comes from Supabase
// magic links on the bakery side. This validates locally and advances the flow.
export function RampLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function submit(event: React.FormEvent) {
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
    router.push("/ramp/home");
  }

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
        {submitting ? "Continuing…" : "Continue"}
      </button>
      <div className="rampFormFooter" />
    </form>
  );
}
