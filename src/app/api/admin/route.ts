import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { EVENT_ID, getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncRampOrder } from "@/lib/ramp-sync";

const requestSchema = z.object({
  action: z.enum(["set_balance", "reassign_member", "remove_member", "merge_teams", "archive_team", "delete_team", "set_deadline", "create_invite", "set_admin", "reconcile_ramp"]),
  teamId: z.string().uuid().optional(),
  sourceTeamId: z.string().uuid().optional(),
  destinationTeamId: z.string().uuid().optional(),
  membershipId: z.string().uuid().optional(),
  balanceCents: z.number().int().min(0).max(100_000_000).optional(),
  reason: z.string().trim().max(240).optional(),
  deadline: z.string().datetime().optional(),
  email: z.email().optional(),
  role: z.enum(["ADMIN", "SUPERADMIN", "REMOVE"]).optional(),
});

const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");

async function requireEventTeam(teamId: string) {
  const { data } = await createAdminClient().from("teams").select("id").eq("id", teamId).eq("event_id", EVENT_ID).maybeSingle();
  if (!data) throw new Error("Team not found in this event.");
}

async function requireEventMember(membershipId: string) {
  const { data } = await createAdminClient().from("team_members").select("id").eq("id", membershipId).eq("event_id", EVENT_ID).is("left_at", null).maybeSingle();
  if (!data) throw new Error("Active participant not found in this event.");
}

export async function POST(request: Request) {
  const actor = await getCurrentAdmin();
  if (!actor) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  try {
    const input = requestSchema.parse(await request.json());
    const admin = createAdminClient();
    let error: { message: string } | null = null;

    if (input.action === "set_balance") {
      if (!input.teamId || input.balanceCents === undefined) throw new Error("Team and balance are required.");
      await requireEventTeam(input.teamId);
      ({ error } = await admin.rpc("admin_set_team_balance", { target_team_id: input.teamId, target_balance_cents: input.balanceCents, adjustment_reason: input.reason ?? "Admin balance update", actor_user_id: actor.id }));
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
    } else if (input.action === "archive_team" || input.action === "delete_team") {
      if (!input.teamId) throw new Error("Team is required.");
      await requireEventTeam(input.teamId);
      ({ error } = await admin.rpc(input.action === "archive_team" ? "admin_archive_team" : "admin_delete_empty_team", { target_team_id: input.teamId }));
    } else if (input.action === "set_deadline") {
      if (!input.deadline) throw new Error("A deadline is required.");
      ({ error } = await admin.from("events").update({ submission_deadline_at: input.deadline }).eq("id", EVENT_ID));
    } else if (input.action === "create_invite") {
      if (!input.teamId) throw new Error("Team is required.");
      await requireEventTeam(input.teamId);
      const token = randomBytes(24).toString("base64url");
      ({ error } = await admin.from("team_invites").insert({ event_id: EVENT_ID, team_id: input.teamId, token_hash: tokenHash(token), created_by: actor.id, expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString() }));
      if (!error) return NextResponse.json({ inviteUrl: `${new URL(request.url).origin}/?invite=${token}` });
    } else if (input.action === "set_admin") {
      if (actor.role !== "SUPERADMIN") return NextResponse.json({ error: "Superadmin access required." }, { status: 403 });
      if (!input.email || !input.role) throw new Error("Email and role are required.");
      const { data: profile } = await admin.from("profiles").select("id").eq("email", input.email.toLowerCase()).maybeSingle();
      if (!profile) throw new Error("That person must sign in once before becoming an admin.");
      ({ error } = await admin.rpc("admin_set_event_admin", { target_event_id: EVENT_ID, target_user_id: profile.id, target_role: input.role === "REMOVE" ? null : input.role }));
    } else if (input.action === "reconcile_ramp") {
      const { data: orders, error: ordersError } = await admin.from("orders").select("id,teams!inner(event_id)").eq("teams.event_id", EVENT_ID).neq("status", "FULFILLED").order("created_at");
      if (ordersError) throw new Error(ordersError.message);
      let synced = 0; let failed = 0;
      for (const order of orders ?? []) {
        try { await syncRampOrder(order.id); synced += 1; } catch { failed += 1; }
      }
      return NextResponse.json({ ok: true, message: `Checked ${synced + failed} unfinished orders; ${synced} synchronized${failed ? `, ${failed} need review` : ""}.` });
    }

    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to complete admin action." }, { status: 400 });
  }
}
