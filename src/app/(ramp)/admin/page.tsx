import { AdminLogin } from "@/components/ramp/AdminLogin";
import { AdminTabs, type LiveOrder, type LiveTeam } from "@/components/ramp/AdminTabs";
import { RampAppShell } from "@/components/ramp/RampAppShell";
import { adminPasswordConfigured, isAdminAuthed } from "@/lib/ramp/admin-auth";
import { EVENT_ID } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sampleHomeData } from "@/lib/ramp/sample-home";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  // Password gate rather than the Supabase admin session, so the console can be
  // opened during the event. Live queries only run once authorised.
  if (!(await isAdminAuthed())) {
    return <AdminLogin configured={adminPasswordConfigured()} />;
  }

  const db = createAdminClient();
  const [{ data: teamRows }, { data: funds }, { data: memberships }, { data: orderRows }] = await Promise.all([
    db.from("teams").select("id,name,status").eq("event_id", EVENT_ID).order("created_at"),
    db.from("team_funds").select("team_id,available_cents,fund_limit_cents"),
    db.from("team_members").select("team_id").eq("event_id", EVENT_ID).is("left_at", null),
    db
      .from("orders")
      .select("id,invoice_number,status,total_cents,created_at,teams!inner(name,event_id)")
      .eq("teams.event_id", EVENT_ID)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const fundsByTeam = new Map((funds ?? []).map((f) => [f.team_id, f]));
  const memberCounts = new Map<string, number>();
  for (const m of memberships ?? []) memberCounts.set(m.team_id, (memberCounts.get(m.team_id) ?? 0) + 1);
  const orderCounts = new Map<string, number>();

  const orders: LiveOrder[] = (orderRows ?? []).map((o) => ({
    id: o.id,
    invoice_number: o.invoice_number,
    status: o.status,
    total_cents: o.total_cents,
    created_at: o.created_at,
    team_name: (o.teams as unknown as { name: string }).name,
  }));

  const teams: LiveTeam[] = (teamRows ?? []).map((team) => ({
    id: team.id,
    name: team.name,
    status: team.status,
    availableCents: fundsByTeam.get(team.id)?.available_cents ?? 0,
    fundLimitCents: fundsByTeam.get(team.id)?.fund_limit_cents ?? 0,
    memberCount: memberCounts.get(team.id) ?? 0,
    orderCount: orderCounts.get(team.id) ?? 0,
  }));

  return (
    <RampAppShell nav={sampleHomeData.nav}>
      <AdminTabs teams={teams} orders={orders} />
    </RampAppShell>
  );
}
