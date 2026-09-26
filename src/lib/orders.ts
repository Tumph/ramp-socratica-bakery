import { randomUUID } from "node:crypto";
import { catalogById } from "./catalog";
import { createAdminClient } from "./supabase/admin";
import { syncRampOrder } from "./ramp-sync";

export type RequestedItem = { productId: string; quantity: number };

export async function createOrder(teamId: string, requestedItems: RequestedItem[]) {
  const lines = requestedItems.filter((item) => Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20).map((item) => {
    const product = catalogById.get(item.productId); if (!product) throw new Error(`Unknown product: ${item.productId}`); return { product, quantity: item.quantity };
  });
  if (!lines.length) throw new Error("Choose at least one product.");
  const totalCents = lines.reduce((total, line) => total + line.product.priceCents * line.quantity, 0);
  const id = randomUUID(); const invoiceNumber = `SOC-${id.slice(0, 8).toUpperCase()}`; const admin = createAdminClient();
  const { data: team, error: teamError } = await admin.from("teams").select("id, available_cash_cents, team_ramp_entities(ramp_entity_id)").eq("id", teamId).single();
  if (teamError || !team) throw new Error("Team not found.");
  if (team.available_cash_cents < totalCents) throw new Error("This order exceeds the team's available cash.");
  const vendorId = process.env.RAMP_VENDOR_ID;
  const mapping = team.team_ramp_entities as unknown as { ramp_entity_id: string } | null;
  if (!vendorId || !mapping?.ramp_entity_id) throw new Error("This team has not been connected to a Ramp bakery entity yet.");
  const { error } = await admin.from("orders").insert({ id, team_id: teamId, invoice_number: invoiceNumber, status: "BILL_CREATING", total_cents: totalCents });
  if (error) throw error;
  const { error: linesError } = await admin.from("order_lines").insert(lines.map((line) => ({ order_id: id, product_id: line.product.id, product_name: line.product.name, quantity: line.quantity, unit_price_cents: line.product.priceCents })));
  if (linesError) throw linesError;
  await admin.from("teams").update({ available_cash_cents: team.available_cash_cents - totalCents }).eq("id", teamId);
  await admin.from("order_ramp_sync").insert({ order_id: id, entity_id: mapping.ramp_entity_id, vendor_id: vendorId });
  try {
    const bill = await syncRampOrder(id);
    return { id, invoiceNumber, totalCents, rampBillId: bill.id, mode: bill.mode };
  } catch (cause) {
    await admin.from("orders").update({ status: "INTEGRATION_ERROR", error_message: cause instanceof Error ? cause.message : "Unknown Ramp error" }).eq("id", id);
    return { id, invoiceNumber, totalCents, rampBillId: null, mode: "sandbox" as const, integrationPending: true };
  }
}

export async function fulfillOrderByBillId(rampBillId: string) {
  const { data, error } = await createAdminClient().rpc("fulfill_paid_order", { target_bill_id: rampBillId });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("No event order is mapped to this Ramp bill.");
  return { orderId: result.order_id, alreadyFulfilled: result.already_fulfilled };
}
