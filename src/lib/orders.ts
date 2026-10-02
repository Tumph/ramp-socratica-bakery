import { randomUUID } from "node:crypto";
import { getVendor } from "./catalog";
import { createAdminClient } from "./supabase/admin";

export type RequestedItem = { productId: string; quantity: number };

export function normalizePurchaseLines(requestedItems: RequestedItem[], vendorSlug: string) {
  const vendor = getVendor(vendorSlug);
  if (!vendor) throw new Error("Unknown store.");
  const catalogById = new Map(vendor.catalog.map((product) => [product.id, product]));
  const lines = requestedItems.map((item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new Error("Invalid product quantity.");
    const product = catalogById.get(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    return { productId: product.id, productName: product.name, quantity: item.quantity, unitPriceCents: product.priceCents };
  });
  if (!lines.length) throw new Error("Choose at least one product.");
  return lines;
}

export async function createOrder(teamId: string, userId: string, eventId: string, requestedItems: RequestedItem[], vendorSlug: string, requestId = randomUUID()) {
  const vendor = getVendor(vendorSlug);
  if (!vendor) throw new Error("Unknown store.");
  const lines = normalizePurchaseLines(requestedItems, vendor.slug);
  const orderId = randomUUID();
  const invoiceNumber = `${vendor.invoicePrefix}-${orderId.slice(0, 8).toUpperCase()}`;
  const { data, error } = await createAdminClient().rpc("post_mock_card_purchase", {
    target_event_id: eventId,
    target_team_id: teamId,
    target_user_id: userId,
    target_request_id: requestId,
    target_order_id: orderId,
    target_invoice_number: invoiceNumber,
    target_vendor_slug: vendor.slug,
    target_lines: lines,
  });
  if (error) throw new Error(error.message);
  const result = data?.[0];
  if (!result) throw new Error("The workshop card service did not return a purchase result.");
  if (result.transaction_status === "DECLINED") throw new Error("This purchase was declined because the shared fund does not have enough money.");
  return { id: result.order_id, vendorSlug: vendor.slug, invoiceNumber, totalCents: result.total_cents, transactionId: result.transaction_id, availableCents: result.available_cents, mode: "simulator" as const };
}
