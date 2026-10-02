import { randomUUID } from "node:crypto";
import { getActiveStoreProducts } from "./store/catalog-server";
import { createAdminClient } from "./supabase/admin";

export type RequestedItem = { productId: string; quantity: number };
type PurchaseLine = { productId: string; productName: string; quantity: number; unitPriceCents: number };

export type VendorPurchase = {
  vendorSlug: string;
  orderId: string;
  invoiceNumber: string;
  lines: PurchaseLine[];
};

/**
 * Resolves the mixed cart from the server-owned catalogue and divides it into
 * one purchase per merchant. The caller can never select a price or merchant.
 */
export async function normalizeMixedPurchaseLines(requestedItems: RequestedItem[]): Promise<VendorPurchase[]> {
  const products = await getActiveStoreProducts();
  const productsById = new Map(products.map((product) => [product.id, product]));
  const byVendor = new Map<string, RequestedItem[]>();

  for (const item of requestedItems) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) {
      throw new Error("Invalid product quantity.");
    }
    const product = productsById.get(item.productId);
    if (!product) throw new Error(`Unknown product: ${item.productId}`);
    const lines = byVendor.get(product.vendorSlug) ?? [];
    lines.push(item);
    byVendor.set(product.vendorSlug, lines);
  }

  if (!byVendor.size) throw new Error("Choose at least one product.");

  return [...byVendor].map(([vendorSlug, items]) => {
    const orderId = randomUUID();
    const invoicePrefix = vendorSlug.replace(/[^a-z0-9]/gi, "").slice(0, 3).toUpperCase() || "STR";
    return {
      vendorSlug,
      orderId,
      invoiceNumber: `${invoicePrefix}-${orderId.slice(0, 8).toUpperCase()}`,
      lines: items.map((item) => {
        const product = productsById.get(item.productId)!;
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPriceCents: product.priceCents,
        };
      }),
    };
  });
}

export async function createMixedStoreCheckout(
  teamId: string,
  userId: string,
  eventId: string,
  requestedItems: RequestedItem[],
  requestId = randomUUID(),
) {
  const purchases = await normalizeMixedPurchaseLines(requestedItems);
  const { data, error } = await createAdminClient().rpc("post_mixed_store_checkout", {
    target_event_id: eventId,
    target_team_id: teamId,
    target_user_id: userId,
    target_request_id: requestId,
    target_purchases: purchases,
  });
  if (error) {
    if (error.message.includes("reached the purchase limit for this product")) {
      throw new Error("Your team has already reached its lifetime allowance for this product. Remove it from the cart or choose another item.");
    }
    throw new Error(error.message);
  }
  const results = (data ?? []) as Array<{
    checkout_id: string;
    order_id: string;
    transaction_id: string;
    vendor_slug: string;
    invoice_number: string;
    total_cents: number;
    available_cents: number;
    transaction_status: string;
  }>;
  if (!results.length) throw new Error("The workshop card service did not return a checkout result.");
  if (results[0].transaction_status === "DECLINED") {
    throw new Error("This purchase was declined because the shared fund does not have enough money.");
  }

  return {
    id: results[0].checkout_id as string,
    totalCents: results.reduce((total, result) => total + result.total_cents, 0),
    availableCents: results[results.length - 1]!.available_cents,
    orders: results.map((result) => ({
      id: result.order_id as string,
      vendorSlug: result.vendor_slug as string,
      invoiceNumber: result.invoice_number as string,
      totalCents: result.total_cents as number,
      transactionId: result.transaction_id as string,
    })),
    mode: "simulator" as const,
  };
}
