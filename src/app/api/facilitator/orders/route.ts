import { NextResponse } from "next/server";
import { getCurrentAdmin } from "@/lib/auth";
import { EVENT_ID } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentAdmin();
  if (!user) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data } = await createAdminClient().from("orders").select("id, invoice_number, status, total_cents, ramp_bill_id, ramp_status, error_message, created_at, teams!inner(name,event_id)").eq("teams.event_id", EVENT_ID).order("created_at", { ascending: false }).limit(100);
  const orders = (data ?? []).map((order) => ({ ...order, team_name: (order.teams as unknown as { name: string }).name }));
  return NextResponse.json({ orders });
}
