"use client";

import { useState } from "react";

type Purpose = "SIGNUP" | "LOGIN";

export function AuthFlow() {
  const [purpose, setPurpose] = useState<Purpose>("SIGNUP");
  const [email, setEmail] = useState("");
  const [teamCode, setTeamCode] = useState("");
  const [code, setCode] = useState("");
  const [developmentCode, setDevelopmentCode] = useState("");
  const [stage, setStage] = useState<"DETAILS" | "CODE">("DETAILS");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  function switchPurpose(nextPurpose: Purpose) {
    setPurpose(nextPurpose);
    setStage("DETAILS");
    setCode("");
    setDevelopmentCode("");
    setError("");
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purpose, email, ...(purpose === "SIGNUP" ? { teamCode } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to send a code.");
      setEmail(result.email);
      setDevelopmentCode(result.developmentCode ?? "");
      setStage("CODE");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to send a code.");
    } finally {
      setWorking(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to verify the code.");
      window.location.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to verify the code.");
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="authPanel panel">
      <div className="authIntro">
        <p className="eyebrow">Bakery team access</p>
        <h1>{purpose === "SIGNUP" ? "Join your bakery." : "Welcome back."}</h1>
        <p>No password needed. We’ll send a six-digit code to your email.</p>
      </div>
      <div className="authCard">
        <div className="authTabs">
          <button className={purpose === "SIGNUP" ? "selected" : ""} onClick={() => switchPurpose("SIGNUP")}>Create account</button>
          <button className={purpose === "LOGIN" ? "selected" : ""} onClick={() => switchPurpose("LOGIN")}>Log in</button>
        </div>
        {stage === "DETAILS" ? (
          <form onSubmit={requestCode}>
            <label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            {purpose === "SIGNUP" && <label>Team code<input required value={teamCode} onChange={(event) => setTeamCode(event.target.value)} placeholder="Provided by your facilitator" /></label>}
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={working}>{working ? "Sending…" : "Email me a code"}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <p className="codeHelp">Enter the code sent to <strong>{email}</strong>.</p>
            {developmentCode && <p className="devCode">Development code: <strong>{developmentCode}</strong></p>}
            <label>Six-digit code<input className="codeInput" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            {error && <p className="error">{error}</p>}
            <button className="primary" disabled={working || code.length !== 6}>{working ? "Checking…" : "Verify and continue"}</button>
            <button type="button" className="linkButton" onClick={() => setStage("DETAILS")}>Use a different email</button>
          </form>
        )}
      </div>
    </section>
  );
}
