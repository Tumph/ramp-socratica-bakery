import type { Metadata } from "next";
import { StoreCartProvider } from "@/components/store/StoreCart";
import { readCart } from "@/lib/store/cart-server";
import { getActiveStoreProducts } from "@/lib/store/catalog-server";
import "./store.css";

export const metadata: Metadata = {
  title: "Socratica Store",
  description: "For the love of making dough.",
};

export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read once here so every store route shares one cart.
  const products = await getActiveStoreProducts();
  const lines = await readCart(new Set(products.map((product) => product.id)));

  return (
    <html lang="en">
      <body>
        <StoreCartProvider lines={lines} products={products}>{children}</StoreCartProvider>
      </body>
    </html>
  );
}
