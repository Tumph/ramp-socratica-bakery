"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export default function AuthCallbackPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let active = true;

    async function finishSignIn() {
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
        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Your team invitation could not be accepted.");
          return;
        }
      }
      window.location.replace("/");
    }

    void finishSignIn();
    return () => { active = false; };
  }, []);

  return <main><section className="authPanel panel"><p className="eyebrow">Signing in</p><h1>{error ? "Sign-in link didn’t work" : "Finishing sign-in…"}</h1><p>{error || "Please wait a moment."}</p></section></main>;
}
