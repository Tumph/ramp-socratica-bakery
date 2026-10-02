"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { applyCartChange, CART_COOKIE, LAST_ORDER_COOKIE, serializeCart } from "@/lib/store/cart";
import { readCart } from "@/lib/store/cart-server";
import { getCurrentUser } from "@/lib/auth";
import { createMixedStoreCheckout } from "@/lib/orders";
import { shopAccess } from "@/lib/teams";
import { getActiveStoreProducts } from "@/lib/store/catalog-server";

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
  const products = await getActiveStoreProducts();
  const product = products.find((candidate) => candidate.id === productId);
  if (!product) {
    throw new Error("That product is no longer available.");
  }
  if (product.inventoryQuantity === 0) throw new Error("That product is sold out.");
  const productIds = new Set(products.map((candidate) => candidate.id));
  const lines = await readCart(productIds);
  const existingQuantity = lines.find((line) => line.productId === productId)?.quantity ?? 0;
  const allowed = Math.min(product.perTeamLimit, product.inventoryQuantity);
  await write(applyCartChange(lines, { type: "add", productId, quantity: Math.max(0, Math.min(quantity, allowed - existingQuantity)) }, productIds));
}

export async function removeFromCart(productId: string, quantity = 1) {
  const productIds = new Set((await getActiveStoreProducts()).map((product) => product.id));
  await write(applyCartChange(await readCart(productIds), { type: "remove", productId, quantity }, productIds));
}

export async function clearCart() {
  await write([]);
}

/**
 * Completes the whole mixed cart in one atomic checkout. The database produces
 * a distinct vendor order, invoice, and Ramp transaction for every area, while
 * this Store keeps the consolidated cart lines for its single receipt.
 */
export async function completeOrder() {
  const productIds = new Set((await getActiveStoreProducts()).map((product) => product.id));
  const lines = await readCart(productIds);
  if (lines.length === 0) return;

  const user = await getCurrentUser();
  if (!user) throw new Error("Log in before placing an order.");
  if (!(await shopAccess(user.teamId)).allowed) {
    throw new Error("The shop opens after the project deadline for teams with at least three members.");
  }

  await createMixedStoreCheckout(user.teamId, user.id, user.eventId, lines);

  const store = await cookies();
  store.set(LAST_ORDER_COOKIE, serializeCart(lines), COOKIE_OPTIONS);
  store.set(CART_COOKIE, serializeCart([]), COOKIE_OPTIONS);
  revalidatePath("/store", "layout");
  redirect("/store/receipt");
}
