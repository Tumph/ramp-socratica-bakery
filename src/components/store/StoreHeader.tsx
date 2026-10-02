"use client";

import Link from "next/link";
import { useStoreCart } from "./StoreCart";

/** Chips are optional: the about and market pages show neither. */
export function StoreHeader({ showCart = false }: { showCart?: boolean }) {
  return (
    <header className="storeHeader">
      <Link href="/store" className="storeLogo" aria-label="Socratica Store">
        <img src="/store/logo.svg" alt="" aria-hidden />
      </Link>

      <p className="storeTagline">
        <span className="storeRule" aria-hidden />
        For the love of making dough.
        <span className="storeRule" aria-hidden />
      </p>

      {showCart ? <StoreChips /> : <span className="storeCart">Cart &mdash; 0</span>}
    </header>
  );
}

function StoreChips() {
  const { count, totalCents } = useStoreCart();
  return (
    <div className="storeChips">
      <Link href="/store/cart" className="storeCart">Cart &mdash; {count}</Link>
      <span className="storeCart">Dollar &mdash; {Math.round(totalCents / 100)}</span>
    </div>
  );
}
