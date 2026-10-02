import { catalogById, type Product } from "../catalog";
import { activeTeam, type SimulatorConfig, type Vendor } from "./config";
import type { ExpenseDetail, IncompleteExpense } from "./types";

/**
 * Joins the configured vendors to the real catalogue, and turns a completed
 * purchase into the expense the Ramp pages render.
 *
 * Kept free of layout so the /store UI can be built straight from the design.
 */

export type VendorStall = Vendor & { products: Product[] };

export type PurchaseLine = { productId: string; quantity: number };

/** Vendors with their products resolved; vendors selling nothing are dropped. */
export function storefrontVendors(config: SimulatorConfig): VendorStall[] {
  return config.vendors
    .map((vendor) => ({
      ...vendor,
      products: vendor.productIds
        .map((id) => catalogById.get(id))
        .filter((product): product is Product => Boolean(product)),
    }))
    .filter((stall) => stall.products.length > 0);
}

export function vendorForProductId(config: SimulatorConfig, productId: string) {
  return config.vendors.find((vendor) => vendor.productIds.includes(productId));
}

/** Server-side total; never trust a browser-supplied amount. */
export function purchaseTotalCents(lines: PurchaseLine[]) {
  return lines.reduce((total, line) => {
    const product = catalogById.get(line.productId);
    if (!product) throw new Error(`Unknown product: ${line.productId}`);
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("Invalid product quantity.");
    }
    return total + product.priceCents * line.quantity;
  }, 0);
}

/** "Sep 29 at 8:53 p.m." — the format the expense card uses. */
export function shortTimestamp(date: Date) {
  const month = date.toLocaleString("en-US", { month: "short" });
  const hour12 = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = date.getHours() < 12 ? "a.m." : "p.m.";
  return `${month} ${date.getDate()} at ${hour12}:${minutes} ${suffix}`;
}

/** "Sep 29, 2026 at 8:53 p.m." — the format the detail page uses. */
export function longTimestamp(date: Date) {
  const month = date.toLocaleString("en-US", { month: "short" });
  const hour12 = date.getHours() % 12 || 12;
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = date.getHours() < 12 ? "a.m." : "p.m.";
  return `${month} ${date.getDate()}, ${date.getFullYear()} at ${hour12}:${minutes} ${suffix}`;
}

export type Purchase = {
  id: string;
  vendorId: string;
  lines: PurchaseLine[];
  /** Card the purchase was charged to. */
  cardId: string;
  at: Date;
};

/**
 * Builds the home-feed representation. The vendor's memo prefills the field,
 * which is what makes it a *suggestion* rather than something the participant
 * typed — the receipt is still theirs to attach.
 */
export function incompleteExpenseFor(config: SimulatorConfig, purchase: Purchase): IncompleteExpense {
  const vendor = config.vendors.find((v) => v.id === purchase.vendorId);
  if (!vendor) throw new Error(`Unknown vendor: ${purchase.vendorId}`);

  const team = activeTeam(config);
  const card = team.cards.find((c) => c.id === purchase.cardId) ?? team.cards[0];

  return {
    id: purchase.id,
    amountCents: purchaseTotalCents(purchase.lines),
    currency: card?.currency ?? "CAD",
    merchantName: vendor.name,
    merchantLogoSrc: vendor.logoSrc,
    occurredAtLabel: shortTimestamp(purchase.at),
    spentFrom: card ? `${card.name} (${card.displaySuffix})` : "",
    spentFromOptions: team.cards.map((c) => `${c.name} (${c.displaySuffix})`),
    receiptRequired: true,
    memoRequired: true,
    memo: vendor.autofillMemo,
  };
}

/** Builds the detail-page representation of the same purchase. */
export function expenseDetailFor(config: SimulatorConfig, purchase: Purchase): ExpenseDetail {
  const summary = incompleteExpenseFor(config, purchase);
  const team = activeTeam(config);
  const amountLabel = `${(summary.amountCents / 100).toFixed(2)} ${summary.currency}`;

  return {
    id: summary.id,
    amountLabel,
    merchantName: summary.merchantName,
    merchantLogoSrc: summary.merchantLogoSrc,
    cardholder: team.viewer.firstName,
    occurredAtLabel: longTimestamp(purchase.at),
    notice: {
      title: "Missing items",
      body: "Complete the missing items for this transaction.",
      actionLabel: "More actions",
    },
    fields: [
      {
        id: "spent-from",
        icon: "field-card",
        label: "Spent from",
        value: summary.spentFrom,
        options: summary.spentFromOptions,
      },
      {
        id: "memo",
        icon: "memo-sparkle",
        label: "Memo",
        value: summary.memo,
        tone: "suggestion",
        editable: true,
      },
      {
        id: "receipt",
        icon: "field-receipt",
        label: "Receipt",
        value: "Upload a receipt (required)",
        missing: true,
      },
    ],
    requirementsNote: { prefix: "Requirements set by", source: "General Expenses" },
    sections: [
      { id: "approvals", title: "Approvals", badge: { label: "Complete", tone: "positive" }, collapsed: true, action: "Ask Ramp" },
      { id: "accounting", title: "Accounting", badge: { label: "Unsynced", tone: "neutral" }, collapsed: true, action: "Mark ready" },
    ],
    activity: [
      { id: "spent", text: `Spent CA$${(summary.amountCents / 100).toFixed(2)} at ${summary.merchantName}` },
    ],
  };
}
