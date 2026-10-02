"use client";

import { createContext, useCallback, useContext, useMemo, useOptimistic, useTransition } from "react";
import { addToCart, removeFromCart } from "@/app/(store)/cart-actions";
import { applyCartChange, cartTotals, type CartLine } from "@/lib/store/cart";

type Change = { type: "add" | "remove"; productId: string; quantity?: number };

type Ctx = {
  lines: CartLine[];
  add: (productId: string, quantity?: number) => void;
  remove: (productId: string, quantity?: number) => void;
  count: number;
  totalCents: number;
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
export function StoreCartProvider({ lines, children }: { lines: CartLine[]; children: React.ReactNode }) {
  const [optimisticLines, applyOptimistic] = useOptimistic(lines, (state: CartLine[], change: Change) =>
    applyCartChange(state, change),
  );
  const [pending, startTransition] = useTransition();

  const add = useCallback(
    (productId: string, quantity = 1) => {
      startTransition(async () => {
        applyOptimistic({ type: "add", productId, quantity });
        await addToCart(productId, quantity);
      });
    },
    [applyOptimistic],
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
    const { count, totalCents } = cartTotals(optimisticLines);
    return { lines: optimisticLines, add, remove, count, totalCents, pending };
  }, [optimisticLines, add, remove, pending]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useStoreCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useStoreCart must be used inside StoreCartProvider");
  return ctx;
}
