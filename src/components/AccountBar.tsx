"use client";

export function AccountBar({ email, teamName }: { email: string; teamName: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="accountBar">
      <div><span>Ordering for</span><strong>{teamName}</strong><small>{email}</small></div>
      <button className="secondary" onClick={logout}>Log out</button>
    </div>
  );
}
