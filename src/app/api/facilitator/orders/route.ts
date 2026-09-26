import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDatabase } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (user.role !== "FACILITATOR") return NextResponse.json({ error: "Facilitator access required." }, { status: 403 });

  const orders = getDatabase().prepare(`
    SELECT o.id, o.invoice_number, o.status, o.total_cents, o.ramp_bill_id,
           o.ramp_status, o.error_message, o.created_at, t.name AS team_name
    FROM orders o JOIN teams t ON t.id = o.team_id
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all();
  return NextResponse.json({ orders });
}
