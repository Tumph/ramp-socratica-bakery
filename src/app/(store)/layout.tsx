import type { Metadata } from "next";
import { StoreCartProvider } from "@/components/store/StoreCart";
import { readCart } from "@/lib/store/cart-server";
import "./store.css";

export const metadata: Metadata = {
  title: "Socratica Store",
  description: "For the love of making dough.",
};

export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Read once here so every store route shares one cart.
  const lines = await readCart();

  return (
    <html lang="en">
      <body>
        <StoreCartProvider lines={lines}>{children}</StoreCartProvider>
      </body>
    </html>
  );
}
