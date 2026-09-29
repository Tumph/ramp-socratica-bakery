"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type AdminTeam = { id: string; name: string; status: string; available_cash_cents: number; owner_user_id: string | null; created_at: string; orderCount: number; members: { id: string; user_id: string; role: "OWNER" | "MEMBER"; email: string }[] };
export type AdminRecord = { email: string; role: "ADMIN" | "SUPERADMIN" };

function formatMoney(cents: number) { return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100); }
function teamStatus(team: AdminTeam, deadline: string) {
  if (team.status === "ARCHIVED") return "ARCHIVED";
  if (new Date(deadline) <= new Date()) return team.members.length >= 3 ? "SHOP_OPEN" : "LOCKED_INELIGIBLE";
  if (team.members.length < 3) return "FORMING";
  return team.members.length === 6 ? "FULL" : "READY";
}

export function AdminConsole({ teams, admins, deadline, actorRole }: { teams: AdminTeam[]; admins: AdminRecord[]; deadline: string; actorRole: "ADMIN" | "SUPERADMIN" }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);

  async function action(payload: Record<string, unknown>) {
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Admin action failed.");
      setNotice(data.message ?? "Saved.");
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Admin action failed."); }
    finally { setWorking(false); }
  }

  function submitBalance(event: React.FormEvent<HTMLFormElement>, teamId: string) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const dollars = Number(data.get("balance"));
    if (!Number.isFinite(dollars) || dollars < 0) return setError("Enter a non-negative balance.");
    void action({ action: "set_balance", teamId, balanceCents: Math.round(dollars * 100), reason: String(data.get("reason") ?? "") });
  }

  return <section className="adminConsole">
    {(notice || error) && <p className={error ? "error" : "adminNotice"}>{error || notice}</p>}

    <div className="adminGrid">
      <section className="panel adminCard"><p className="eyebrow">Event controls</p><h2>Submission deadline</h2>
        <form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("deadline")); if (value) void action({ action: "set_deadline", deadline: new Date(value).toISOString() }); }}>
          <label>Deadline<input name="deadline" type="datetime-local" defaultValue={new Date(deadline).toISOString().slice(0, 16)} /></label>
          <button className="primary" disabled={working}>Update deadline</button>
        </form>
      </section>
      <section className="panel adminCard"><p className="eyebrow">Team operations</p><h2>Merge teams</h2><p className="mutedCopy">Moves people and the source balance. Both teams must have no orders and the result must contain at most six people.</p>
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); if (window.confirm("Merge these teams? This moves all source participants.")) void action({ action: "merge_teams", sourceTeamId: data.get("source"), destinationTeamId: data.get("destination") }); }}>
          <label>Source team<select name="source" required><option value="">Choose a team</option>{teams.filter((team) => team.status !== "ARCHIVED").map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <label>Destination team<select name="destination" required><option value="">Choose a team</option>{teams.filter((team) => team.status !== "ARCHIVED").map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select></label>
          <button className="secondary" disabled={working}>Merge teams</button>
        </form>
      </section>
      <section className="panel adminCard"><p className="eyebrow">Ramp operations</p><h2>Reconcile orders</h2><p className="mutedCopy">Checks every unfinished event order against Ramp and fulfills only verified paid bills.</p><button className="primary" disabled={working} onClick={() => void action({ action: "reconcile_ramp" })}>Reconcile Ramp now</button></section>
      {actorRole === "SUPERADMIN" && <section className="panel adminCard"><p className="eyebrow">Access control</p><h2>Admins</h2><p className="mutedCopy">A person must have signed in at least once before you can grant access.</p>
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "set_admin", email: data.get("email"), role: data.get("role") }); }}>
          <label>Email<input name="email" type="email" required placeholder="person@example.com" /></label>
          <label>Role<select name="role"><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option><option value="REMOVE">Remove admin access</option></select></label>
          <button className="primary" disabled={working}>Save access</button>
        </form>
        <div className="adminList">{admins.map((admin) => <p key={admin.email}><strong>{admin.email}</strong><span className="status">{admin.role}</span></p>)}</div>
      </section>}
    </div>

    <div className="adminTeamsHeader"><div><p className="eyebrow">Teams</p><h2>{teams.length} teams</h2></div><p className="mutedCopy">Status is calculated from deadline, membership, and manual archiving.</p></div>
    <div className="teamAdminList">{teams.map((team) => <section className="panel teamAdminCard" key={team.id}>
      <header><div><h3>{team.name}</h3><p className="mutedCopy">{team.members.length}/6 members · {team.orderCount} orders · balance {formatMoney(team.available_cash_cents)}</p></div><span className="status">{teamStatus(team, deadline)}</span></header>
      <div className="teamAdminTools">
        <form onSubmit={(event) => submitBalance(event, team.id)}><label>Set balance (CAD)<input name="balance" type="number" min="0" step="0.01" defaultValue={(team.available_cash_cents / 100).toFixed(2)} /></label><label>Reason<input name="reason" maxLength={240} placeholder="e.g. Opening allocation" /></label><button className="secondary" disabled={working}>Save balance</button></form>
        <div className="teamActions"><button className="secondary" disabled={working || team.status === "ARCHIVED"} onClick={() => { if (window.confirm("Soft-delete this empty team?")) void action({ action: "archive_team", teamId: team.id }); }}>Soft delete</button></div>
      </div>
      <div className="memberAdminList">{team.members.length === 0 ? <p className="mutedCopy">No active participants.</p> : team.members.map((member) => <div className="memberAdminRow" key={member.id}><div><strong>{member.email}</strong><small>{member.role}</small></div><label>Move to<select defaultValue="" onChange={(event) => { if (event.target.value && window.confirm(`Move ${member.email}?`)) void action({ action: "reassign_member", membershipId: member.id, destinationTeamId: event.target.value }); event.currentTarget.value = ""; }}><option value="">Choose team</option>{teams.filter((candidate) => candidate.id !== team.id && candidate.status !== "ARCHIVED" && candidate.members.length < 6).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.members.length}/6)</option>)}</select></label><button className="linkButton" disabled={working} onClick={() => { if (window.confirm(`Remove ${member.email} from ${team.name}?`)) void action({ action: "remove_member", membershipId: member.id }); }}>Remove</button></div>)}</div>
    </section>)}</div>
  </section>;
}
