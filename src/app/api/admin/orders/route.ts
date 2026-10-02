import { NextResponse } from "next/server";
import { EVENT_ID, getCurrentAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function GET() {
  if (!(await getCurrentAdmin())) return NextResponse.json({ error: "Admin access required." }, { status: 403 });

  const { data, error } = await createAdminClient()
    .from("orders")
    .select("id, invoice_number, status, total_cents, error_message, created_at, teams!inner(name,event_id)")
    .eq("teams.event_id", EVENT_ID)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    orders: (data ?? []).map((order) => ({
      ...order,
      team_name: (order.teams as unknown as { name: string }).name,
    })),
  });
}
