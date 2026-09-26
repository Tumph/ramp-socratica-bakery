import { FacilitatorOrders, type FacilitatorOrder } from "@/components/FacilitatorOrders";
import { AdminConsole, type AdminRecord, type AdminTeam } from "@/components/AdminConsole";
import { redirect } from "next/navigation";
import { EVENT_ID, getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function FacilitatorPage() {
  const admin = await getCurrentAdmin();
  if (!admin) redirect("/");

  const { data } = await createAdminClient().from("orders").select("id, invoice_number, status, total_cents, ramp_bill_id, ramp_status, error_message, created_at, teams!inner(name,event_id)").eq("teams.event_id", EVENT_ID).order("created_at", { ascending: false }).limit(100);
  const orders = (data ?? []).map((order) => ({ ...order, team_name: (order.teams as unknown as { name: string }).name })) as FacilitatorOrder[];
  const db = createAdminClient();
  const [{ data: event }, { data: teamRows }, { data: memberships }, { data: adminRows }, { data: orderTeams }] = await Promise.all([
    db.from("events").select("submission_deadline_at").eq("id", EVENT_ID).single(),
    db.from("teams").select("id,name,status,available_cash_cents,owner_user_id,created_at").eq("event_id", EVENT_ID).order("created_at"),
    db.from("team_members").select("id,team_id,user_id,role,profiles!inner(email)").eq("event_id", EVENT_ID).is("left_at", null),
    db.from("event_admins").select("role,profiles!inner(email)").eq("event_id", EVENT_ID),
    db.from("orders").select("team_id"),
  ]);
  const orderCounts = new Map<string, number>();
  for (const order of orderTeams ?? []) orderCounts.set(order.team_id, (orderCounts.get(order.team_id) ?? 0) + 1);
  const teams: AdminTeam[] = (teamRows ?? []).map((team) => ({
    ...team,
    orderCount: orderCounts.get(team.id) ?? 0,
    members: (memberships ?? []).filter((member) => member.team_id === team.id).map((member) => ({ id: member.id, user_id: member.user_id, role: member.role as "OWNER" | "MEMBER", email: (member.profiles as unknown as { email: string }).email })),
  }));
  const admins: AdminRecord[] = (adminRows ?? []).map((record) => ({ role: record.role as "ADMIN" | "SUPERADMIN", email: (record.profiles as unknown as { email: string }).email }));

  return (
    <main>
      <section className="pageHeading">
        <p className="eyebrow">Event control room</p>
        <h1>Admin console</h1>
        <p>Trace supplier orders into Ramp and watch fulfillment state.</p>
      </section>
      <AdminConsole teams={teams} admins={admins} deadline={event?.submission_deadline_at ?? new Date().toISOString()} actorRole={admin.role} />
      <FacilitatorOrders initialOrders={orders} />
    </main>
  );
}
