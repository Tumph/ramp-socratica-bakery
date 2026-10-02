import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, invoice_number, status, total_cents, created_at, teams!inner(name), vendors!inner(slug,display_name)").eq("id", id).eq("team_id", user.teamId).maybeSingle();

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const { data: lines } = await admin.from("order_lines").select("product_id, product_name, quantity, unit_price_cents").eq("order_id", id).order("id");

  return NextResponse.json({ order, lines });
}
