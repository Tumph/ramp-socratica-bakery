"use client";

import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/lib/catalog";
import { AllergenAlert } from "./AllergenAlert";
import { QuantityStepper } from "./QuantityStepper";
import { useStoreCart } from "./StoreCart";

const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export function ProductDetail({
  product,
  areaId,
  perTeamLimit = 4,
  allergens = "Baked in a facility that uses soy.",
}: {
  product: Product;
  areaId: string;
  perTeamLimit?: number;
  allergens?: string;
}) {
  const { add } = useStoreCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  function addToCart() {
    for (let i = 0; i < quantity; i += 1) add(product.id);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  }

  return (
    <div className="shopDetail">
      <Link href={`/store/market/${areaId}`} className="shopBack">Back</Link>

      <div className="shopDetailGrid">
        <div className="shopDetailInfo">
          <div className="shopDetailTop">
            <h1 className="shopDetailName">{product.name}</h1>
            <p className="shopDetailDesc">{product.description}</p>
            <span className="shopDetailPrice">{money(product.priceCents)}</span>
          </div>

          <div className="shopDetailActions">
            <div className="shopQuantityRow">
              <div>
                <p className="shopQuantityLabel">Quantity</p>
                <p className="shopQuantityLimit">Limit of {perTeamLimit} per team.</p>
              </div>
              <QuantityStepper value={quantity} max={perTeamLimit} onChange={setQuantity} />
            </div>

            <button type="button" className="shopAddToCart" onClick={addToCart}>
              {added ? "Added" : "Add to Cart"}
            </button>

            <AllergenAlert body={allergens} />
          </div>
        </div>

        <div className="shopDetailArt">
          <img src={`/store/products/${product.id}.png`} alt={product.name} />
        </div>
      </div>
    </div>
  );
}
