"use client";
import { useState } from "react";
export function AuthFlow() {
  const [email, setEmail] = useState(""); const [working, setWorking] = useState(false); const [sent, setSent] = useState(false); const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setWorking(true); setError("");
    try { const response = await fetch("/api/auth/request-code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to send a sign-in link."); setSent(true); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to send a sign-in link."); } finally { setWorking(false); }
  }
  return <section className="authPanel panel"><div className="authIntro"><p className="eyebrow">Bakery team access</p><h1>Join your bakery.</h1><p>Enter your email and we’ll send a secure sign-in link.</p></div><div className="authCard">{sent ? <p className="authHelp">Check <strong>{email}</strong> for your sign-in link. After signing in, create a bakery team or join an open one.</p> : <form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>{error && <p className="error">{error}</p>}<button className="primary" disabled={working}>{working ? "Sending…" : "Email me a sign-in link"}</button></form>}</div></section>;
}
