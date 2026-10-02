import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { z } from "zod";
import { EVENT_ID, getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const requestSchema = z.object({
  action: z.enum(["create_team", "invite_member", "set_fund_limits", "reassign_member", "remove_member", "merge_teams", "archive_team", "set_deadline", "set_admin"]),
  teamId: z.string().uuid().optional(),
  sourceTeamId: z.string().uuid().optional(),
  destinationTeamId: z.string().uuid().optional(),
  membershipId: z.string().uuid().optional(),
  fundLimits: z.array(z.object({ teamId: z.uuid(), fundLimitCents: z.number().int().min(0).max(100_000_000) })).min(1).max(100).optional(),
  reason: z.string().trim().max(240).optional(),
  deadline: z.string().datetime().optional(),
  email: z.email().optional(),
  role: z.enum(["ADMIN", "SUPERADMIN", "REMOVE"]).optional(),
  teamName: z.string().trim().min(3).max(80).optional(),
  inviteEmails: z.string().max(2_000).optional(),
});

function parseInvitationEmails(value: string | undefined) {
  const emails = (value ?? "")
    .split(/[,;\n]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const uniqueEmails = [...new Set(emails)];

  if (emails.length !== uniqueEmails.length) throw new Error("Each participant email can only be included once.");
  if (uniqueEmails.length > 6) throw new Error("A team can have at most six participants.");
  for (const email of uniqueEmails) {
    if (!z.email().safeParse(email).success) throw new Error(`Invalid participant email: ${email}`);
  }
  return uniqueEmails;
}

async function requireEventTeam(teamId: string) {
  const { data } = await createAdminClient().from("teams").select("id").eq("id", teamId).eq("event_id", EVENT_ID).maybeSingle();
  if (!data) throw new Error("Team not found in this event.");
}

async function requireEventMember(membershipId: string) {
  const { data } = await createAdminClient().from("team_members").select("id").eq("id", membershipId).eq("event_id", EVENT_ID).is("left_at", null).maybeSingle();
  if (!data) throw new Error("Active participant not found in this event.");
}

async function sendTeamInvitation({
  admin,
  actorUserId,
  teamId,
  email,
  origin,
}: {
  admin: ReturnType<typeof createAdminClient>;
  actorUserId: string;
  teamId: string;
  email: string;
  origin: string;
}) {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error: invitationError } = await admin.rpc("admin_create_team_invitation", {
    target_event_id: EVENT_ID,
    target_team_id: teamId,
    target_email: email,
    target_token_hash: tokenHash,
    target_expires_at: expiresAt,
    actor_user_id: actorUserId,
  });
  if (invitationError) throw new Error(invitationError.message);

  const { error: emailError } = await admin.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?invite=${encodeURIComponent(token)}` },
  });
  if (emailError) throw new Error(emailError.message);
}

export async function POST(request: Request) {
  const actor = await getCurrentAdmin();
  if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const input = requestSchema.parse(await request.json());
    const admin = createAdminClient();
    let error: { message: string } | null = null;

    if (input.action === "create_team") {
      if (!input.teamName) throw new Error("A team name is required.");
      const inviteEmails = parseInvitationEmails(input.inviteEmails);
      const teamId = randomUUID();
      ({ error } = await admin.rpc("admin_create_empty_team", {
        target_team_id: teamId,
        target_event_id: EVENT_ID,
        target_name: input.teamName,
        target_slug: `team-${randomBytes(6).toString("hex")}`,
      }));
      if (!error && inviteEmails.length) {
        const origin = new URL(request.url).origin;
        const failures: string[] = [];
        let sent = 0;
        for (const email of inviteEmails) {
          try {
            await sendTeamInvitation({ admin, actorUserId: actor.id, teamId, email, origin });
            sent += 1;
          } catch (inviteError) {
            failures.push(`${email} (${inviteError instanceof Error ? inviteError.message : "unable to send"})`);
          }
        }
        if (failures.length) {
          return NextResponse.json({ ok: true, message: `Team created. Sent ${sent} of ${inviteEmails.length} invitation emails. Retry these from the team: ${failures.join("; ")}` });
        }
        return NextResponse.json({ ok: true, message: `Team created and ${sent} invitation email${sent === 1 ? "" : "s"} sent.` });
      }
    } else if (input.action === "invite_member") {
      if (!input.email || !input.teamId) throw new Error("Participant email and team are required.");
      await requireEventTeam(input.teamId);
      await sendTeamInvitation({ admin, actorUserId: actor.id, teamId: input.teamId, email: input.email.toLowerCase(), origin: new URL(request.url).origin });
    } else if (input.action === "set_fund_limits") {
      if (!input.fundLimits) throw new Error("At least one team fund limit is required.");
      await Promise.all(input.fundLimits.map(({ teamId }) => requireEventTeam(teamId)));
      ({ error } = await admin.rpc("admin_set_team_fund_limits", {
        target_event_id: EVENT_ID,
        target_limits: input.fundLimits.map(({ teamId, fundLimitCents }) => ({ team_id: teamId, fund_limit_cents: fundLimitCents })),
        adjustment_reason: input.reason ?? "Admin fund limit update",
        actor_user_id: actor.id,
      }));
    } else if (input.action === "reassign_member") {
      if (!input.membershipId || !input.destinationTeamId) throw new Error("Participant and destination team are required.");
      await Promise.all([requireEventMember(input.membershipId), requireEventTeam(input.destinationTeamId)]);
      ({ error } = await admin.rpc("admin_reassign_member", { membership_id: input.membershipId, destination_team_id: input.destinationTeamId }));
    } else if (input.action === "remove_member") {
      if (!input.membershipId) throw new Error("Participant is required.");
      await requireEventMember(input.membershipId);
      ({ error } = await admin.rpc("admin_remove_member", { membership_id: input.membershipId }));
    } else if (input.action === "merge_teams") {
      if (!input.sourceTeamId || !input.destinationTeamId) throw new Error("Source and destination teams are required.");
      await Promise.all([requireEventTeam(input.sourceTeamId), requireEventTeam(input.destinationTeamId)]);
      ({ error } = await admin.rpc("admin_merge_teams", { source_team_id: input.sourceTeamId, destination_team_id: input.destinationTeamId, actor_user_id: actor.id }));
    } else if (input.action === "archive_team") {
      if (!input.teamId) throw new Error("Team is required.");
      await requireEventTeam(input.teamId);
      ({ error } = await admin.rpc("admin_archive_team", { target_team_id: input.teamId }));
    } else if (input.action === "set_deadline") {
      if (!input.deadline) throw new Error("A deadline is required.");
      ({ error } = await admin.from("events").update({ submission_deadline_at: input.deadline }).eq("id", EVENT_ID));
    } else if (input.action === "set_admin") {
      if (actor.role !== "SUPERADMIN") return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
      if (!input.email || !input.role) throw new Error("Email and role are required.");
      const { data: profile } = await admin.from("profiles").select("id").eq("email", input.email.toLowerCase()).maybeSingle();
      if (!profile) throw new Error("That person must sign in once before becoming an admin.");
      ({ error } = await admin.rpc("admin_set_event_admin", { target_event_id: EVENT_ID, target_user_id: profile.id, target_role: input.role === "REMOVE" ? null : input.role }));
    }

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, message: input.action === "invite_member" ? "Invitation email sent." : "Saved." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete admin action." }, { status: 400 });
  }
}
