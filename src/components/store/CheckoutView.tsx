"use client";

import Link from "next/link";
import { completeOrder } from "@/app/(store)/cart-actions";
import { catalogById } from "@/lib/catalog";
import { CartSummary } from "./CartSummary";
import { CheckoutLine } from "./CheckoutLine";
import { SummaryScaleTuner } from "./SummaryScaleTuner";
import { useStoreCart } from "./StoreCart";

export function CheckoutView() {
  const { lines, totalCents } = useStoreCart();

  const rows = lines
    .map((line) => ({ product: catalogById.get(line.productId), quantity: line.quantity }))
    .filter((row): row is { product: NonNullable<typeof row.product>; quantity: number } =>
      Boolean(row.product),
    );

  return (
    <div className="checkout">
      <Link href="/store/market" className="shopBack">Back</Link>

      <div className="checkoutGrid">
        <section className="checkoutCart">
          <h1 className="storeDisplay">Shopping Cart</h1>

          {rows.length === 0 ? (
            <p className="checkoutEmpty">Your cart is empty. Head back to the market to add something.</p>
          ) : (
            <>
              <div className="checkoutHead">
                <span>Item</span>
                <span>Quantity</span>
                <span>Price</span>
              </div>
              <ul className="checkoutLines">
                {rows.map((row) => (
                  <CheckoutLine key={row.product.id} product={row.product} quantity={row.quantity} />
                ))}
              </ul>
            </>
          )}
        </section>

        <CartSummary
          subtotalCents={totalCents}
          totalCents={totalCents}
          disabled={rows.length === 0}
          onPayWithRamp={() => completeOrder()}
        />
      </div>

      <SummaryScaleTuner />
    </div>
  );
}
