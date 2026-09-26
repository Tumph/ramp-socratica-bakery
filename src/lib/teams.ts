import { randomBytes, createHash } from "node:crypto";
import { EVENT_ID, type AuthenticatedUser } from "./auth";
import { createAdminClient } from "./supabase/admin";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export async function createTeam(user: AuthenticatedUser, name: string) {
  const admin = createAdminClient(); const { data: existing } = await admin.from("team_members").select("id").eq("event_id", EVENT_ID).eq("user_id", user.id).is("left_at", null).maybeSingle();
  if (existing) throw new Error("You are already on a team.");
  const { data: team, error } = await admin.from("teams").insert({ event_id: EVENT_ID, name, slug: `team-${randomBytes(6).toString("hex")}`, starting_cash_cents: 0, available_cash_cents: 0, owner_user_id: user.id }).select("id").single();
  if (error || !team) throw new Error(error?.message ?? "Unable to create team.");
  const { error: memberError } = await admin.from("team_members").insert({ event_id: EVENT_ID, team_id: team.id, user_id: user.id, role: "OWNER" });
  if (memberError) throw new Error(memberError.message);
  await admin.from("submissions").insert({ event_id: EVENT_ID, team_id: team.id });
  return team.id;
}
export async function createInvite(user: AuthenticatedUser, teamId: string) {
  const admin = createAdminClient(); const { data: member } = await admin.from("team_members").select("role").eq("event_id", EVENT_ID).eq("team_id", teamId).eq("user_id", user.id).is("left_at", null).maybeSingle();
  if (!member || member.role !== "OWNER") throw new Error("Only the team owner can create invitations.");
  const token = randomBytes(24).toString("base64url"); const { error } = await admin.from("team_invites").insert({ event_id: EVENT_ID, team_id: teamId, token_hash: hash(token), created_by: user.id, expires_at: new Date(Date.now() + 7 * 864e5).toISOString() });
  if (error) throw new Error(error.message); return token;
}
export async function acceptInvite(user: AuthenticatedUser, token: string) {
  const admin = createAdminClient(); const { data: existing } = await admin.from("team_members").select("id").eq("event_id", EVENT_ID).eq("user_id", user.id).is("left_at", null).maybeSingle(); if (existing) throw new Error("You are already on a team.");
  const { data: invite } = await admin.from("team_invites").select("id,team_id,expires_at").eq("token_hash", hash(token)).is("revoked_at", null).is("accepted_at", null).maybeSingle();
  if (!invite || new Date(invite.expires_at) <= new Date()) throw new Error("This invitation is invalid or expired.");
  const { error } = await admin.from("team_members").insert({ event_id: EVENT_ID, team_id: invite.team_id, user_id: user.id, role: "MEMBER" }); if (error) throw new Error(error.message);
  await admin.from("team_invites").update({ accepted_at: new Date().toISOString(), accepted_by: user.id }).eq("id", invite.id); return invite.team_id;
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
