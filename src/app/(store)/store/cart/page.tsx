import { CheckoutView } from "@/components/store/CheckoutView";
import { StoreHeader } from "@/components/store/StoreHeader";

export default function CartPage() {
  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain checkoutMain">
        <CheckoutView />
      </main>
    </div>
  );
}
