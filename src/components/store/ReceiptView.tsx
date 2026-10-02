import Link from "next/link";
import { catalogById } from "@/lib/catalog";
import type { CartLine } from "@/lib/store/cart";

export function ReceiptView({ lines }: { lines: CartLine[] }) {
  // One thumbnail per distinct product, in the order they were bought.
  const products = lines
    .map((line) => catalogById.get(line.productId))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  return (
    <div className="receipt">
      <div className="receiptText">
        <h1 className="storeDisplay">Thank You :)</h1>
        <p className="receiptBody">
          All your items should be delivered to you in about 5 minutes! We look forward to seeing
          what you create with all of these ingredients.
        </p>
      </div>

      <div className="receiptFoot">
        {products.length > 0 && (
          <ul className="receiptItems">
            {products.map((product) => (
              <li key={product.id}>
                <img src={`/store/products/${product.id}.png`} alt={product.name} />
              </li>
            ))}
          </ul>
        )}

        <Link href="/store/market" className="receiptBack">Back to Shopping</Link>
      </div>
    </div>
  );
}
