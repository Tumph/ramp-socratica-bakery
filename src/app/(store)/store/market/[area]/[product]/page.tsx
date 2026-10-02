import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/store/ProductDetail";
import { StoreHeader } from "@/components/store/StoreHeader";
import { catalogById } from "@/lib/catalog";
import { defaultConfig } from "@/lib/ramp/config";

export function generateStaticParams() {
  return defaultConfig.vendors.flatMap((vendor) =>
    vendor.productIds.map((productId) => ({ area: vendor.id, product: productId })),
  );
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ area: string; product: string }>;
}) {
  const { area, product: productId } = await params;
  const vendor = defaultConfig.vendors.find((v) => v.id === area);
  const product = catalogById.get(productId);
  if (!vendor || !product || !vendor.productIds.includes(productId)) notFound();

  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain shopMain shopMain--wide">
        <ProductDetail product={product} areaId={vendor.id} />
      </main>
    </div>
  );
}
