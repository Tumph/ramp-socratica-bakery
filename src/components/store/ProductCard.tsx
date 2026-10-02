"use client";

import Link from "next/link";
import type { Product } from "@/lib/catalog";
import { useStoreCart } from "./StoreCart";

const money = (cents: number) =>
  cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;

export function ProductCard({ product, areaId }: { product: Product; areaId: string }) {
  const { add } = useStoreCart();

  return (
    <article className="shopCard">
      <Link
        href={`/store/market/${areaId}/${product.id}`}
        className="shopCardArt"
        aria-label={`View ${product.name}`}
      >
        <img src={`/store/products/${product.id}.png`} alt="" aria-hidden />
      </Link>

      <div className="shopCardInfo">
        <div className="shopCardText">
          <h2 className="shopCardName">{product.name}</h2>
          <p className="shopCardDesc">{product.description}</p>
        </div>
        <button type="button" className="shopPrice" onClick={() => add(product.id)} aria-label={`Add ${product.name} to cart`}>
          {money(product.priceCents)}
        </button>
      </div>
    </article>
  );
}
