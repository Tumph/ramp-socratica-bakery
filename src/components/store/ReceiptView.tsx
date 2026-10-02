import Link from "next/link";
import type { CartLine } from "@/lib/store/cart";
import type { StoreProduct } from "@/lib/store/catalog-server";

export function ReceiptView({ lines, products: catalogue }: { lines: CartLine[]; products: StoreProduct[] }) {
  const productsById = new Map(catalogue.map((product) => [product.id, product]));
  // One thumbnail per distinct product, in the order they were bought.
  const receiptProducts = lines
    .map((line) => productsById.get(line.productId))
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
        {receiptProducts.length > 0 && (
          <ul className="receiptItems">
            {receiptProducts.map((product) => (
              <li key={product.id}>
                <img src={`/store/products/${product.imageFilename ?? `${product.id}.png`}`} alt={product.name} />
              </li>
            ))}
          </ul>
        )}

        <Link href="/store/market" className="receiptBack">Back to Shopping</Link>
      </div>
    </div>
  );
}
