import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/store/ProductDetail";
import { StoreHeader } from "@/components/store/StoreHeader";
import { getActiveStoreProducts, getActiveStoreVendors } from "@/lib/store/catalog-server";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ area: string; product: string }>;
}) {
  const { area, product: productId } = await params;
  const [products, vendors] = await Promise.all([getActiveStoreProducts(), getActiveStoreVendors()]);
  const vendor = vendors.find((vendor) => vendor.slug === area);
  const product = products.find((product) => product.id === productId && product.vendorSlug === area);
  if (!vendor || !product) notFound();

  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain shopMain shopMain--wide">
        <ProductDetail product={product} areaId={vendor.slug} />
      </main>
    </div>
  );
}
