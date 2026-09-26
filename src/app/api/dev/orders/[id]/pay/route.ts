import { NextResponse } from "next/server";
import { getDatabase } from "@/lib/db";
import { fulfillOrderByBillId } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  if ((process.env.RAMP_MODE ?? "mock") !== "mock") {
    return NextResponse.json({ error: "Mock payment is disabled outside mock mode." }, { status: 404 });
  }

  const { id } = await context.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const order = getDatabase().prepare("SELECT ramp_bill_id FROM orders WHERE id = ? AND team_id = ?").get(id, user.teamId) as
    | { ramp_bill_id: string | null }
    | undefined;
  if (!order?.ramp_bill_id) return NextResponse.json({ error: "Order or mock bill not found." }, { status: 404 });
  if (!order.ramp_bill_id.startsWith("mock_bill_")) {
    return NextResponse.json({ error: "Only mock bills can use simulated local payment." }, { status: 400 });
  }

  return NextResponse.json(fulfillOrderByBillId(order.ramp_bill_id));
}
