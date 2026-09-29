import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrder } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import { shopAccess } from "@/lib/teams";

export const runtime = "nodejs";

const orderSchema = z.object({
  items: z.array(z.object({
    productId: z.string().min(1).max(80),
    quantity: z.number().int().min(1).max(20),
  })).min(1),
});

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Log in before placing an order." }, { status: 401 });
    if (!(await shopAccess(user.teamId)).allowed) return NextResponse.json({ error: "The shop opens after the project deadline for teams with at least three members." }, { status: 403 });
    const input = orderSchema.parse(await request.json());
    const requestId = request.headers.get("idempotency-key");
    const idempotencyKey = requestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ? requestId as `${string}-${string}-${string}-${string}-${string}` : undefined;
    const order = await createOrder(user.teamId, user.id, user.eventId, input.items, idempotencyKey);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create order.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
