import { ReceiptView } from "@/components/store/ReceiptView";
import { StoreHeader } from "@/components/store/StoreHeader";
import { readLastOrder } from "@/lib/store/cart-server";

export default async function ReceiptPage() {
  const lines = await readLastOrder();

  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain receiptMain">
        <ReceiptView lines={lines} />
      </main>
    </div>
  );
}
