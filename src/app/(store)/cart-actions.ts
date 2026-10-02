"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyCartChange, CART_COOKIE, LAST_ORDER_COOKIE, serializeCart } from "@/lib/store/cart";
import { readCart } from "@/lib/store/cart-server";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7,
};

async function write(lines: Awaited<ReturnType<typeof readCart>>) {
  (await cookies()).set(CART_COOKIE, serializeCart(lines), COOKIE_OPTIONS);
  // The cart renders in the store layout, so every store route is stale.
  revalidatePath("/store", "layout");
}

export async function addToCart(productId: string, quantity = 1) {
  await write(applyCartChange(await readCart(), { type: "add", productId, quantity }));
}

export async function removeFromCart(productId: string, quantity = 1) {
  await write(applyCartChange(await readCart(), { type: "remove", productId, quantity }));
}

export async function clearCart() {
  await write([]);
}

/**
 * Completes the purchase: stashes the lines for the receipt, empties the cart,
 * then sends the shopper to the confirmation page.
 */
export async function completeOrder() {
  const lines = await readCart();
  if (lines.length === 0) return;

  const store = await cookies();
  store.set(LAST_ORDER_COOKIE, serializeCart(lines), COOKIE_OPTIONS);
  store.set(CART_COOKIE, serializeCart([]), COOKIE_OPTIONS);
  revalidatePath("/store", "layout");
  redirect("/store/receipt");
}
