"use client";

import type { Product } from "@/lib/catalog";
import { QuantityStepper } from "./QuantityStepper";
import { useStoreCart } from "./StoreCart";

const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export function CheckoutLine({ product, quantity }: { product: Product; quantity: number }) {
  const { add, remove } = useStoreCart();

  return (
    <li className="checkoutLine">
      <div className="checkoutItem">
        <img className="checkoutThumb" src={`/store/products/${product.imageFilename ?? `${product.id}.png`}`} alt="" aria-hidden />
        <span className="checkoutName">{product.name}</span>
      </div>

      <div className="checkoutQty">
        <QuantityStepper
          value={quantity}
          min={0}
          onChange={(next) => (next > quantity ? add(product.id) : remove(product.id))}
        />
      </div>

      <span className="checkoutPrice">{money(product.priceCents * quantity)}</span>
    </li>
  );
}
