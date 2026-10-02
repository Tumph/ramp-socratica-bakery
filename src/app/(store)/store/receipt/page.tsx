import { ReceiptView } from "@/components/store/ReceiptView";
import { StoreHeader } from "@/components/store/StoreHeader";
import { readLastOrder } from "@/lib/store/cart-server";
import { getActiveStoreProducts } from "@/lib/store/catalog-server";

export default async function ReceiptPage() {
  const products = await getActiveStoreProducts();
  const lines = await readLastOrder(new Set(products.map((product) => product.id)));

  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain receiptMain">
        <ReceiptView lines={lines} products={products} />
      </main>
    </div>
  );
}
