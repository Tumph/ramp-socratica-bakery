import { AdminTabs } from "@/components/ramp/AdminTabs";
import { RampAppShell } from "@/components/ramp/RampAppShell";
import type { AdminRecord, AdminTeam } from "@/components/AdminConsole";
import type { FacilitatorOrder } from "@/components/FacilitatorOrders";
import { EVENT_ID, getCurrentAdmin } from "@/lib/auth";
import { sampleHomeData } from "@/lib/ramp/sample-home";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const actor = await getCurrentAdmin();
  if (!actor) redirect("/");

  const db = createAdminClient();
  const [{ data: event }, { data: teamRows }, { data: funds }, { data: memberships }, { data: invitations }, { data: adminRows }, { data: orderRows }] = await Promise.all([
    db.from("events").select("submission_deadline_at").eq("id", EVENT_ID).single(),
    db.from("teams").select("id,name,status,owner_user_id,created_at").eq("event_id", EVENT_ID).order("created_at"),
    db.from("team_funds").select("team_id,available_cents,fund_limit_cents"),
    db.from("team_members").select("id,team_id,user_id,role,profiles!inner(email)").eq("event_id", EVENT_ID).is("left_at", null),
    db.from("team_invitations").select("id,team_id,email,expires_at").eq("event_id", EVENT_ID).is("accepted_at", null).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at"),
    db.from("event_admins").select("user_id,role,profiles!inner(email)").eq("event_id", EVENT_ID),
    db.from("orders").select("id,team_id,invoice_number,status,total_cents,error_message,created_at,teams!inner(name,event_id)").eq("teams.event_id", EVENT_ID).order("created_at", { ascending: false }).limit(100),
  ]);

  const orderCounts = new Map<string, number>();
  for (const order of orderRows ?? []) orderCounts.set(order.team_id, (orderCounts.get(order.team_id) ?? 0) + 1);
  const fundDetails = new Map((funds ?? []).map((fund) => [fund.team_id, fund]));
  const teams: AdminTeam[] = (teamRows ?? []).map((team) => ({
    ...team,
    availableCents: fundDetails.get(team.id)?.available_cents ?? 0,
    fundLimitCents: fundDetails.get(team.id)?.fund_limit_cents ?? 0,
    orderCount: orderCounts.get(team.id) ?? 0,
    members: (memberships ?? []).filter((member) => member.team_id === team.id).map((member) => ({
      id: member.id,
      user_id: member.user_id,
      role: member.role as "OWNER" | "MEMBER",
      email: (member.profiles as unknown as { email: string }).email,
    })),
    pendingInvitations: (invitations ?? []).filter((invitation) => invitation.team_id === team.id).map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      expires_at: invitation.expires_at,
    })),
  }));
  const admins: AdminRecord[] = (adminRows ?? []).map((record) => ({
    role: record.role as "ADMIN" | "SUPERADMIN",
    email: (record.profiles as unknown as { email: string }).email,
  }));
  const orders: FacilitatorOrder[] = (orderRows ?? []).map((order) => ({
    id: order.id,
    invoice_number: order.invoice_number,
    status: order.status,
    total_cents: order.total_cents,
    error_message: order.error_message,
    team_name: (order.teams as unknown as { name: string }).name,
  }));

  return (
    <RampAppShell nav={sampleHomeData.nav}>
      <AdminTabs
        teams={teams}
        admins={admins}
        deadline={event?.submission_deadline_at ?? new Date().toISOString()}
        actorRole={actor.role}
        orders={orders}
      />
    </RampAppShell>
  );
}
