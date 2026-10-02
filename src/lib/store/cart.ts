
/**
 * Cart persistence.
 *
 * The cart lives in a cookie rather than localStorage so Server Components can
 * read it directly — the header count renders server-side with no hydration
 * flash, and it survives reloads, navigation and new tabs. Mutations go through
 * Server Functions, which is the only place `cookies().set()` is allowed.
 *
 * This module stays pure so the client can share the reducer for optimistic
 * updates; the cookie read lives in cart-server.ts, which is server-only.
 */

export const CART_COOKIE = "socratica_cart";
/** The lines from the most recent completed order, for the receipt page. */
export const LAST_ORDER_COOKIE = "socratica_last_order";
const MAX_QUANTITY = 99;

export type CartLine = { productId: string; quantity: number };

/** Stored compactly; a cookie is capped at ~4KB. */
type StoredLine = { p: string; q: number };

export function parseCart(raw: string | undefined, productIds = new Set(catalogById.keys())): CartLine[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((entry) => entry as StoredLine)
      .filter((entry) => typeof entry?.p === "string" && Number.isInteger(entry?.q))
      .filter((entry) => productIds.has(entry.p) && entry.q > 0)
      .map((entry) => ({ productId: entry.p, quantity: Math.min(entry.q, MAX_QUANTITY) }));
  } catch {
    return [];
  }
}

export function serializeCart(lines: CartLine[]) {
  const stored: StoredLine[] = lines.map((line) => ({ p: line.productId, q: line.quantity }));
  return JSON.stringify(stored);
}

/** Pure reducer, shared by the server action and the optimistic client update. */
export function applyCartChange(
  lines: CartLine[],
  change: { type: "add" | "remove"; productId: string; quantity?: number },
  productIds = new Set(catalogById.keys()),
): CartLine[] {
  const delta = change.quantity ?? 1;
  const existing = lines.find((line) => line.productId === change.productId);

  if (change.type === "add") {
    if (!productIds.has(change.productId)) return lines;
    if (existing) {
      return lines.map((line) =>
        line.productId === change.productId
          ? { ...line, quantity: Math.min(line.quantity + delta, MAX_QUANTITY) }
          : line,
      );
    }
    return [...lines, { productId: change.productId, quantity: Math.min(delta, MAX_QUANTITY) }];
  }

  return lines
    .map((line) =>
      line.productId === change.productId ? { ...line, quantity: line.quantity - delta } : line,
    )
    .filter((line) => line.quantity > 0);
}

export function cartTotals(
  lines: CartLine[],
  pricesByProductId = new Map(catalogById.entries().map(([id, product]) => [id, product.priceCents])),
) {
  let count = 0;
  let totalCents = 0;
  for (const line of lines) {
    const priceCents = pricesByProductId.get(line.productId);
    if (priceCents === undefined) continue;
    count += line.quantity;
    totalCents += priceCents * line.quantity;
  }
  return { count, totalCents };
}
import { catalogById } from "../catalog";
