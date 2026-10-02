"use client";

import { catalogById } from "@/lib/catalog";
import { useStoreCart } from "./StoreCart";

/** Bottom tray: one stack per product, labelled on hover. */
export function CartDock() {
  const { lines, remove } = useStoreCart();
  if (lines.length === 0) return null;

  return (
    <div className="shopDock">
      <ul className="shopDockItems">
        {lines.map((line) => {
          const product = catalogById.get(line.productId);
          if (!product) return null;
          // Stacked thumbnails overlap, so the group widens with quantity.
          const width = 75 + (line.quantity - 1) * 35;
          return (
            <li key={line.productId} className="shopDockItem" style={{ width }}>
              <span className="shopDockLabel">
                <span className="shopDockQty">x {line.quantity}</span>
                <span className="shopDockName">{product.name}</span>
              </span>
              <button
                type="button"
                className="shopDockStack"
                onClick={() => remove(line.productId)}
                aria-label={`Remove one ${product.name}`}
              >
                {Array.from({ length: line.quantity }).map((_, i) => (
                  <img
                    key={i}
                    src={`/store/products/${product.id}.png`}
                    alt=""
                    aria-hidden
                    style={{ left: i * 35 }}
                  />
                ))}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
