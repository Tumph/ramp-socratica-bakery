import { notFound } from "next/navigation";
import { AreaHeading } from "@/components/store/AreaHeading";
import { CartDock } from "@/components/store/CartDock";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreHeader } from "@/components/store/StoreHeader";
import { VisitPills, type VisitTarget } from "@/components/store/VisitPills";
import { catalogById } from "@/lib/catalog";
import { defaultConfig } from "@/lib/ramp/config";

const TONES: Record<string, VisitTarget["tone"]> = {
  aisle: "mint",
  fruits: "peach",
  fridge: "lilac",
};

const COPY: Record<string, { title: string; blurb: string }> = {
  aisle: { title: "The Aisle", blurb: "Be careful when reaching for the upper shelves!" },
  fruits: { title: "The Fruits", blurb: "Everything here was picked this morning." },
  fridge: { title: "The Fridge", blurb: "Mind the cold — shut the door behind you." },
};

export function generateStaticParams() {
  return defaultConfig.vendors.map((vendor) => ({ area: vendor.id }));
}

export default async function AreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const vendor = defaultConfig.vendors.find((v) => v.id === area);
  if (!vendor) notFound();

  const products = vendor.productIds
    .map((id) => catalogById.get(id))
    .filter((product): product is NonNullable<typeof product> => Boolean(product));

  // The other two areas, for the "pay a visit to" pills.
  const others: VisitTarget[] = defaultConfig.vendors
    .filter((v) => v.id !== vendor.id)
    .map((v) => ({ id: v.id, name: v.name, tone: TONES[v.id] ?? "lilac" }));

  const copy = COPY[vendor.id] ?? { title: vendor.name, blurb: vendor.blurb ?? "" };

  return (
    <div className="storePage">
      <StoreHeader showCart />
      <main className="storeMain shopMain">
        <AreaHeading title={copy.title} blurb={copy.blurb} />
        <VisitPills targets={others} />
        <div className="shopGrid">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} areaId={vendor.id} />
          ))}
        </div>
      </main>
      <CartDock />
    </div>
  );
}
