"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type JoinableTeam = { id: string; name: string; memberCount: number };

type PendingAction =
  | { kind: "create" }
  | { kind: "join"; team: JoinableTeam }
  | null;

export function TeamSetup() {
  const [name, setName] = useState("");
  const [teams, setTeams] = useState<JoinableTeam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    void fetch("/api/teams")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (active) setTeams(data.teams);
      })
      .catch((caught) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to list teams.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function run(body: { action: "create"; name: string } | { action: "join"; teamId: string }) {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.push(`/teams/${data.teamId}`);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to continue.");
      setPendingAction(null);
    } finally {
      setBusy(false);
    }
  }

  function closeDialog() {
    if (!busy) setPendingAction(null);
  }

  return (
    <section className="teamSetup">
      <header className="teamSetupIntro">
        <p className="eyebrow">Team setup</p>
        <h1>Choose your bakery team.</h1>
        <p>Join an open team or start one. Teams need 3–6 members before the project deadline.</p>
      </header>

      <section className="panel teamDirectory" aria-labelledby="available-teams-heading">
        <header className="teamDirectoryHeader">
          <div>
            <h2 id="available-teams-heading">Available teams</h2>
            <p className="mutedCopy">You can join a team once. Contact an event admin if you need a change later.</p>
          </div>
          <button className="primary" type="button" onClick={() => setPendingAction({ kind: "create" })}>
            + Create team
          </button>
        </header>

        <div className="tableScroll">
          <table className="teamTable">
            <thead>
              <tr>
                <th scope="col">Team</th>
                <th scope="col">Members</th>
                <th scope="col"><span className="srOnly">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td className="tableMessage" colSpan={3}>Loading teams…</td></tr>
              ) : teams.length ? (
                teams.map((team) => (
                  <tr key={team.id}>
                    <th scope="row">{team.name}</th>
                    <td>{team.memberCount} of 6</td>
                    <td className="teamTableAction">
                      <button className="secondary" type="button" disabled={busy} onClick={() => setPendingAction({ kind: "join", team })}>
                        Join team
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr><td className="tableMessage" colSpan={3}>No open teams yet. Create the first one.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p className="error" role="alert">{error}</p>}

      {pendingAction?.kind === "create" && (
        <div className="dialogBackdrop" role="presentation" onMouseDown={closeDialog}>
          <section className="dialogPanel" role="dialog" aria-modal="true" aria-labelledby="create-team-heading" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2 id="create-team-heading">Create a team</h2>
              <p className="mutedCopy">You’ll become its first member. Invite others to join from this directory.</p>
            </header>
            <form onSubmit={(event) => { event.preventDefault(); void run({ action: "create", name }); }}>
              <label htmlFor="team-name">Team name
                <input id="team-name" required minLength={3} maxLength={80} autoFocus value={name} onChange={(event) => setName(event.target.value)} />
              </label>
              <div className="dialogActions">
                <button className="secondary" type="button" disabled={busy} onClick={closeDialog}>Cancel</button>
                <button className="primary" disabled={busy}>{busy ? "Creating…" : "Create team"}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {pendingAction?.kind === "join" && (
        <div className="dialogBackdrop" role="presentation" onMouseDown={closeDialog}>
          <section className="dialogPanel" role="dialog" aria-modal="true" aria-labelledby="join-team-heading" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <h2 id="join-team-heading">Join {pendingAction.team.name}?</h2>
              <p className="mutedCopy">This team has {pendingAction.team.memberCount} of 6 members. You’ll need an event admin to move you to a different team later.</p>
            </header>
            <div className="dialogActions">
              <button className="secondary" type="button" disabled={busy} onClick={closeDialog}>Cancel</button>
              <button className="primary" type="button" disabled={busy} onClick={() => void run({ action: "join", teamId: pendingAction.team.id })}>{busy ? "Joining…" : "Join team"}</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
