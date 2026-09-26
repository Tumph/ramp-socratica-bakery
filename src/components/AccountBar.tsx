"use client";

export function AccountBar({ email, teamName, teamId }: { email: string; teamName: string; teamId?: string }) {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="accountBar">
      <div><span>Ordering for</span>{teamId ? <a href={`/teams/${teamId}`}><strong>{teamName}</strong></a> : <strong>{teamName}</strong>}<small>{email}</small></div>
      <button className="secondary" onClick={logout}>Log out</button>
    </div>
  );
}
