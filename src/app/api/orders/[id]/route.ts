import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const database = getDatabase();
  const order = database.prepare(`
    SELECT o.id, o.invoice_number, o.status, o.total_cents, o.ramp_bill_id,
           o.ramp_status, o.created_at, t.name AS team_name
    FROM orders o JOIN teams t ON t.id = o.team_id
    WHERE o.id = ? AND o.team_id = ?
  `).get(id, user.teamId);

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const lines = database.prepare(`
    SELECT product_id, product_name, quantity, unit_price_cents
    FROM order_lines WHERE order_id = ? ORDER BY id
  `).all(id);

  return NextResponse.json({ order, lines });
}
