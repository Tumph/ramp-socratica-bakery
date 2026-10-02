"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminTeam = {
  id: string; name: string; status: string; availableCents: number; fundLimitCents: number; owner_user_id: string | null; created_at: string; orderCount: number;
  members: { id: string; user_id: string; role: "OWNER" | "MEMBER"; email: string }[];
  pendingInvitations: { id: string; email: string; expires_at: string }[];
};
export type AdminRecord = { email: string; role: "ADMIN" | "SUPERADMIN" };
type PendingAction = { title: string; description: string; payload: Record<string, unknown>; confirmLabel: string; destructive?: boolean } | null;

function formatMoney(cents: number) { return new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }).format(cents / 100); }
function teamStatus(team: AdminTeam, deadline: string) {
  if (team.status === "ARCHIVED") return "ARCHIVED";
  if (new Date(deadline) <= new Date()) return team.members.length >= 3 ? "SHOP_OPEN" : "LOCKED_INELIGIBLE";
  if (team.members.length < 3) return "FORMING";
  return team.members.length === 6 ? "FULL" : "READY";
}

export function AdminConsole({ teams, admins, deadline, actorRole, className }: { teams: AdminTeam[]; admins: AdminRecord[]; deadline: string; actorRole: "ADMIN" | "SUPERADMIN"; className?: string }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const activeTeams = useMemo(() => teams.filter((team) => team.status !== "ARCHIVED"), [teams]);
  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;

  async function action(payload: Record<string, unknown>) {
    setWorking(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Admin action failed.");
      setNotice(data.message ?? "Saved.");
      setPendingAction(null);
      router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Admin action failed."); }
    finally { setWorking(false); }
  }

  function submitFundLimits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const fundLimits = activeTeams.map((team) => ({ teamId: team.id, fundLimitCents: Math.round(Number(data.get(`fund-limit-${team.id}`)) * 100) }));
    if (fundLimits.some(({ fundLimitCents }) => !Number.isSafeInteger(fundLimitCents) || fundLimitCents < 0)) return setError("Each fund limit must be a non-negative amount.");
    void action({ action: "set_fund_limits", fundLimits, reason: String(data.get("fund-limit-reason") ?? "") });
  }

  function submitCreateTeam(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("team-name") ?? "").trim();
    if (!name) return setError("Enter a team name.");
    void action({ action: "create_team", teamName: name, inviteEmails: String(data.get("team-member-emails") ?? "") });
    event.currentTarget.reset();
  }

  function submitInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTeam) return;
    const email = String(new FormData(event.currentTarget).get("invite-email") ?? "").trim();
    if (!email) return setError("Enter a participant email address.");
    void action({ action: "invite_member", teamId: selectedTeam.id, email });
    event.currentTarget.reset();
  }

  function closeDialog() { if (!working) setPendingAction(null); }

  return <section className={`adminConsole ${className ?? ""}`}>
    {(notice || error) && <p className={error ? "error" : "adminNotice"} role="status">{error || notice}</p>}

    <div className="adminControls">
      <section className="panel adminCard">
        <p className="eyebrow">Event settings</p><h2>Submission deadline</h2>
        <form onSubmit={(event) => { event.preventDefault(); const value = String(new FormData(event.currentTarget).get("deadline")); if (value) void action({ action: "set_deadline", deadline: new Date(value).toISOString() }); }}>
          <label htmlFor="deadline">Deadline<input id="deadline" name="deadline" type="datetime-local" defaultValue={new Date(deadline).toISOString().slice(0, 16)} /></label>
          <button className="primary" disabled={working}>Save deadline</button>
        </form>
      </section>
      <section className="panel adminCard">
        <p className="eyebrow">Workshop finance</p><h2>Shared funds</h2>
      </section>
      <section className="panel adminCard">
        <p className="eyebrow">Team setup</p><h2>Create a team</h2>
        <form onSubmit={submitCreateTeam}>
          <label htmlFor="team-name">Team name<input id="team-name" name="team-name" required minLength={3} maxLength={80} placeholder="e.g. Team Croissant" /></label>
          <label htmlFor="team-member-emails">Participant emails <span className="mutedCopy">(optional)</span><textarea id="team-member-emails" name="team-member-emails" rows={3} placeholder="ada@example.com, ben@example.com, cy@example.com" aria-describedby="team-member-email-help" /></label>
          <p id="team-member-email-help" className="mutedCopy">Separate up to six email addresses with commas.</p>
          <button className="primary" disabled={working}>Create team and send invitations</button>
        </form>
      </section>
    </div>

    <section className="panel adminTablePanel" aria-labelledby="fund-limits-heading">
      <header className="tableHeader"><div><p className="eyebrow">Workshop finance</p><h2 id="fund-limits-heading">Fund limits</h2></div></header>
      <form onSubmit={submitFundLimits}>
        <div className="tableScroll"><table className="adminTable">
          <thead><tr><th scope="col">Team</th><th scope="col">Fund limit (CAD)</th><th scope="col">Spent</th><th scope="col">Remaining</th></tr></thead>
          <tbody>{activeTeams.length ? activeTeams.map((team) => { const spentCents = team.fundLimitCents - team.availableCents; return <tr key={team.id}><th scope="row">{team.name}</th><td><input aria-label={`${team.name} fund limit in CAD`} name={`fund-limit-${team.id}`} type="number" min="0" step="0.01" defaultValue={(team.fundLimitCents / 100).toFixed(2)} /></td><td>{formatMoney(spentCents)}</td><td className={team.availableCents < 0 ? "negativeBalance" : undefined}>{formatMoney(team.availableCents)}</td></tr>; }) : <tr><td className="tableMessage" colSpan={4}>Create a team before setting fund limits.</td></tr>}</tbody>
        </table></div>
        <div className="fundLimitsFooter"><label htmlFor="fund-limit-reason">Reason (optional)<input id="fund-limit-reason" name="fund-limit-reason" maxLength={240} placeholder="e.g. Grading allocation" /></label><button className="primary" disabled={working || !activeTeams.length}>{working ? "Saving…" : "Save fund limits"}</button></div>
      </form>
    </section>

    <section className="panel adminTablePanel" aria-labelledby="teams-heading">
      <header className="tableHeader">
        <div><p className="eyebrow">Teams</p><h2 id="teams-heading">Team directory</h2></div>
        <button className="secondary" type="button" disabled={working || activeTeams.length < 2} onClick={() => setPendingAction({ title: "Merge teams", description: "Choose the source and destination teams. The source team must have no orders, both teams must be unfunded, and the combined team cannot exceed six members.", payload: { action: "merge_teams" }, confirmLabel: "Merge teams", destructive: true })}>Merge teams</button>
      </header>
      <div className="tableScroll"><table className="adminTable">
        <thead><tr><th scope="col">Team</th><th scope="col">Status</th><th scope="col">Members</th><th scope="col">Fund limit</th><th scope="col">Orders</th><th scope="col"><span className="srOnly">Action</span></th></tr></thead>
        <tbody>{teams.length ? teams.map((team) => <tr key={team.id} className={selectedTeamId === team.id ? "isSelected" : undefined}>
          <th scope="row">{team.name}</th><td><span className="status">{teamStatus(team, deadline).replaceAll("_", " ")}</span></td><td>{team.members.length} of 6</td><td>{formatMoney(team.fundLimitCents)}</td><td>{team.orderCount}</td>
          <td className="teamTableAction"><button className="secondary" type="button" onClick={() => setSelectedTeamId(team.id)}>{selectedTeamId === team.id ? "Managing" : "Manage"}</button></td>
        </tr>) : <tr><td className="tableMessage" colSpan={6}>No teams have been created.</td></tr>}</tbody>
      </table></div>
    </section>

    {selectedTeam && <section className="panel teamManagementPanel" aria-labelledby="manage-team-heading">
      <header className="teamManagementHeader"><div><p className="eyebrow">Team management</p><h2 id="manage-team-heading">{selectedTeam.name}</h2><p className="mutedCopy">{selectedTeam.members.length}/6 members · {selectedTeam.orderCount} orders · {teamStatus(selectedTeam, deadline).replaceAll("_", " ")}</p></div><button className="linkButton" type="button" onClick={() => setSelectedTeamId(null)}>Close</button></header>
      <section className="teamDangerZone"><h3>Team status</h3><button className="dangerButton" type="button" disabled={working || selectedTeam.status === "ARCHIVED"} onClick={() => setPendingAction({ title: `Archive ${selectedTeam.name}?`, description: "This marks the empty team as archived. Its participants must be removed first.", payload: { action: "archive_team", teamId: selectedTeam.id }, confirmLabel: "Archive team", destructive: true })}>Archive team</button></section>
      <section className="membersSection"><header><h3>Invite participants</h3></header><form className="inviteForm" onSubmit={submitInvitation}><label htmlFor="invite-email">Participant email<input id="invite-email" name="invite-email" type="email" required placeholder="person@example.com" /></label><button className="primary" disabled={working || selectedTeam.members.length + selectedTeam.pendingInvitations.length >= 6}>Send invitation</button></form>{selectedTeam.pendingInvitations.length > 0 && <div className="tableScroll"><table className="membersTable"><thead><tr><th scope="col">Invitation pending</th><th scope="col">Expires</th></tr></thead><tbody>{selectedTeam.pendingInvitations.map((invitation) => <tr key={invitation.id}><th scope="row">{invitation.email}</th><td>{new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}</td></tr>)}</tbody></table></div>}</section>
      <section className="membersSection"><header><h3>Members</h3></header><div className="tableScroll"><table className="membersTable"><thead><tr><th scope="col">Participant</th><th scope="col">Role</th><th scope="col">Move to</th><th scope="col"><span className="srOnly">Remove</span></th></tr></thead><tbody>{selectedTeam.members.length ? selectedTeam.members.map((member) => <tr key={member.id}><th scope="row">{member.email}</th><td>{member.role}</td><td><select aria-label={`Move ${member.email} to another team`} defaultValue="" disabled={working} onChange={(event) => { const destination = event.target.value; event.currentTarget.value = ""; if (destination) { const destinationTeam = teams.find((team) => team.id === destination); setPendingAction({ title: `Move ${member.email}?`, description: `This moves the participant from ${selectedTeam.name} to ${destinationTeam?.name ?? "the selected team"}.`, payload: { action: "reassign_member", membershipId: member.id, destinationTeamId: destination }, confirmLabel: "Move participant" }); } }}><option value="">Choose team</option>{teams.filter((candidate) => candidate.id !== selectedTeam.id && candidate.status !== "ARCHIVED" && candidate.members.length < 6).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name} ({candidate.members.length}/6)</option>)}</select></td><td className="teamTableAction"><button className="linkButton" type="button" disabled={working} onClick={() => setPendingAction({ title: `Remove ${member.email}?`, description: `This removes the participant from ${selectedTeam.name}. They will not belong to any bakery team afterward.`, payload: { action: "remove_member", membershipId: member.id }, confirmLabel: "Remove participant", destructive: true })}>Remove</button></td></tr>) : <tr><td className="tableMessage" colSpan={4}>No active participants.</td></tr>}</tbody></table></div></section>
    </section>}

    {actorRole === "SUPERADMIN" && <section className="panel accessPanel" aria-labelledby="access-heading"><header><p className="eyebrow">Access control</p><h2 id="access-heading">Admin access</h2></header><div className="accessGrid"><form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ action: "set_admin", email: data.get("email"), role: data.get("role") }); }}><label htmlFor="admin-email">Email<input id="admin-email" name="email" type="email" required placeholder="person@example.com" /></label><label htmlFor="admin-role">Role<select id="admin-role" name="role"><option value="ADMIN">Admin</option><option value="SUPERADMIN">Superadmin</option><option value="REMOVE">Remove admin access</option></select></label><button className="primary" disabled={working}>Save access</button></form><div className="tableScroll"><table className="accessTable"><thead><tr><th scope="col">Admin</th><th scope="col">Role</th></tr></thead><tbody>{admins.map((admin) => <tr key={admin.email}><th scope="row">{admin.email}</th><td><span className="status">{admin.role}</span></td></tr>)}</tbody></table></div></div></section>}

    {pendingAction && <div className="dialogBackdrop" role="presentation" onMouseDown={closeDialog}><section className="dialogPanel" role="dialog" aria-modal="true" aria-labelledby="admin-action-heading" onMouseDown={(event) => event.stopPropagation()}><header><h2 id="admin-action-heading">{pendingAction.title}</h2><p className="mutedCopy">{pendingAction.description}</p></header>{pendingAction.payload.action === "merge_teams" ? <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void action({ ...pendingAction.payload, sourceTeamId: data.get("source"), destinationTeamId: data.get("destination") }); }}><label htmlFor="merge-source">Source team<select id="merge-source" name="source" required><option value="">Choose a team</option>{activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.members.length}/6)</option>)}</select></label><label htmlFor="merge-destination">Destination team<select id="merge-destination" name="destination" required><option value="">Choose a team</option>{activeTeams.map((team) => <option key={team.id} value={team.id}>{team.name} ({team.members.length}/6)</option>)}</select></label><div className="dialogActions"><button className="secondary" type="button" disabled={working} onClick={closeDialog}>Cancel</button><button className={pendingAction.destructive ? "dangerButton" : "primary"} disabled={working}>{working ? "Saving…" : pendingAction.confirmLabel}</button></div></form> : <div className="dialogActions"><button className="secondary" type="button" disabled={working} onClick={closeDialog}>Cancel</button><button className={pendingAction.destructive ? "dangerButton" : "primary"} type="button" disabled={working} onClick={() => void action(pendingAction.payload)}>{working ? "Saving…" : pendingAction.confirmLabel}</button></div>}</section></div>}
  </section>;
}
