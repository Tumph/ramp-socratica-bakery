import { randomBytes, randomUUID } from "node:crypto";
import { EVENT_ID, type AuthenticatedUser } from "./auth";
import { createAdminClient } from "./supabase/admin";

export type JoinableTeam = { id: string; name: string; memberCount: number };

export async function createTeam(user: AuthenticatedUser, name: string) {
  const { data: teamId, error } = await createAdminClient().rpc("create_event_team", {
    target_team_id: randomUUID(),
    target_event_id: EVENT_ID,
    target_user_id: user.id,
    target_name: name,
    target_slug: `team-${randomBytes(6).toString("hex")}`,
  });
  if (error || !teamId) throw new Error(error?.message ?? "Unable to create team.");
  return teamId;
}

export async function listJoinableTeams() {
  const admin = createAdminClient();
  const [{ data: teams, error: teamsError }, { data: memberships, error: membershipsError }] = await Promise.all([
    admin.from("teams").select("id,name,created_at").eq("event_id", EVENT_ID).neq("status", "ARCHIVED").order("created_at"),
    admin.from("team_members").select("team_id").eq("event_id", EVENT_ID).is("left_at", null),
  ]);
  if (teamsError) throw new Error(teamsError.message);
  if (membershipsError) throw new Error(membershipsError.message);

  const counts = new Map<string, number>();
  for (const membership of memberships ?? []) counts.set(membership.team_id, (counts.get(membership.team_id) ?? 0) + 1);
  return (teams ?? [])
    .map((team): JoinableTeam => ({ id: team.id, name: team.name, memberCount: counts.get(team.id) ?? 0 }))
    .filter((team) => team.memberCount < 6);
}

export async function joinTeam(user: AuthenticatedUser, teamId: string) {
  const { error } = await createAdminClient().rpc("join_event_team", {
    target_team_id: teamId,
    target_event_id: EVENT_ID,
    target_user_id: user.id,
  });
  if (error) throw new Error(error.message);
  return teamId;
}
export async function shopAccess(teamId: string) {
  const admin = createAdminClient();
  const [{ data: event }, { count }, { data: submission }] = await Promise.all([
    admin.from("teams").select("events!inner(submission_deadline_at)").eq("id", teamId).single(),
    admin.from("team_members").select("id", { count: "exact", head: true }).eq("team_id", teamId).is("left_at", null),
    admin.from("submissions").select("id").eq("team_id", teamId).maybeSingle(),
  ]);
  const deadline = (event?.events as unknown as { submission_deadline_at: string } | null)?.submission_deadline_at;
  return { allowed: !!deadline && new Date(deadline) <= new Date() && (count ?? 0) >= 3 && !!submission, memberCount: count ?? 0, deadline };
}
