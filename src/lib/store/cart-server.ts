import "server-only";
import { cookies } from "next/headers";
import { CART_COOKIE, LAST_ORDER_COOKIE, parseCart, type CartLine } from "./cart";

/** Server-only: reads the cart cookie. */
export async function readCart(productIds?: Set<string>): Promise<CartLine[]> {
  return parseCart((await cookies()).get(CART_COOKIE)?.value, productIds);
}

/** Server-only: reads the most recent completed order. */
export async function readLastOrder(productIds?: Set<string>): Promise<CartLine[]> {
  return parseCart((await cookies()).get(LAST_ORDER_COOKIE)?.value, productIds);
}
