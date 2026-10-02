"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition } from "react";
import { addToCart, removeFromCart } from "@/app/(store)/cart-actions";
import { applyCartChange, cartTotals, type CartLine } from "@/lib/store/cart";
import type { StoreProduct } from "@/lib/store/catalog-server";

type Change = { type: "add" | "remove"; productId: string; quantity?: number };

type Ctx = {
  lines: CartLine[];
  add: (productId: string, quantity?: number) => void;
  remove: (productId: string, quantity?: number) => void;
  count: number;
  totalCents: number;
  productsById: Map<string, StoreProduct>;
  pending: boolean;
};

const CartContext = createContext<Ctx | null>(null);

/**
 * Server-owned cart with optimistic client updates.
 *
 * `lines` comes from the cookie via a Server Component, so the first paint is
 * already correct. `useOptimistic` applies the same reducer the server runs, so
 * a click feels instant and then reconciles when the action returns.
 */
export function StoreCartProvider({ lines, products, children }: { lines: CartLine[]; products: StoreProduct[]; children: React.ReactNode }) {
  const productIds = useMemo(() => new Set(products.map((product) => product.id)), [products]);
  const [optimisticLines, applyOptimistic] = useOptimistic(lines, (state: CartLine[], change: Change) =>
    applyCartChange(state, change, productIds),
  );
  const [pending, startTransition] = useTransition();

  const add = useCallback(
    (productId: string, quantity = 1) => {
      const product = products.find((candidate) => candidate.id === productId);
      if (!product || product.inventoryQuantity === 0) return;
      startTransition(async () => {
        applyOptimistic({ type: "add", productId, quantity });
        await addToCart(productId, quantity);
      });
    },
    [applyOptimistic, products],
  );

  const remove = useCallback(
    (productId: string, quantity = 1) => {
      startTransition(async () => {
        applyOptimistic({ type: "remove", productId, quantity });
        await removeFromCart(productId, quantity);
      });
    },
    [applyOptimistic],
  );

  const value = useMemo(() => {
    const productsById = new Map(products.map((product) => [product.id, product]));
    const { count, totalCents } = cartTotals(optimisticLines, new Map(products.map((product) => [product.id, product.priceCents])));
    return { lines: optimisticLines, add, remove, count, totalCents, pending, productsById };
  }, [optimisticLines, products, add, remove, pending]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useStoreCart must be used inside StoreCartProvider");
  return ctx;
}
