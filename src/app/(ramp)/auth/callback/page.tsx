"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { RampHeader } from "@/components/ramp/RampHeader";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function finishSignIn() {
      const supabase = await createBrowserSupabaseClient();
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const result = accessToken && refreshToken
        ? await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
        : await supabase.auth.getSession();
      if (!active) return;
      if (result.error || !result.data.session) {
        setError("That sign-in link is invalid or has expired. Please request a new one.");
        return;
      }
      const invite = new URLSearchParams(window.location.search).get("invite");
      if (invite) {
        const response = await fetch("/api/invitations/accept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: invite }),
        });
        const data = await response.json() as { error?: string };
        if (!response.ok) {
          setError(data.error ?? "Your team invitation could not be accepted.");
          return;
        }
      }
      window.location.replace("/ramp");
    }

    void finishSignIn();
    return () => { active = false; };
  }, []);

  return (
    <div className="rampShell">
      <RampHeader />
      <main className="rampAuth">
        <div className="rampAuthInner">
          <h1>{error ? "Sign-in link didn’t work" : "Finishing sign-in…"}</h1>
          <p className="rampNote">{error || "Please wait a moment."}</p>
        </div>
      </main>
    </div>
  );
}
