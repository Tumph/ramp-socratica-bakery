import { catalog, type Product } from "@/lib/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

export type StoreProduct = Product & { vendorSlug: string; vendorName: string };
export type StoreVendor = { slug: string; name: string };

const fallbackProducts: StoreProduct[] = catalog.flatMap((product) => {
  const vendor = product.id === "flour" || product.id === "boxes"
    ? { slug: "aisle", name: "Aisle" }
    : product.id === "vanilla" || product.id === "chocolate"
      ? { slug: "fruits", name: "Fruits" }
      : { slug: "fridge", name: "Fridge" };
  return [{ ...product, vendorSlug: vendor.slug, vendorName: vendor.name }];
});

/**
 * The database is the live catalogue. The fallback keeps the prototype usable
 * before its migration has been applied (and during static builds without env).
 */
export async function getActiveStoreProducts(): Promise<StoreProduct[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) return fallbackProducts;

  const { data, error } = await createAdminClient()
    .from("store_products")
    .select("id,name,description,unit,price_cents,per_team_limit,inventory_quantity,image_filename,vendors!inner(slug,display_name)")
    .eq("active", true)
    .eq("vendors.active", true)
    .order("created_at");

  if (error) throw new Error(`Unable to load the store catalogue: ${error.message}`);
  return (data ?? []).map((row) => {
    const vendor = Array.isArray(row.vendors) ? row.vendors[0] : row.vendors;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      unit: row.unit,
      priceCents: row.price_cents,
      perTeamLimit: row.per_team_limit,
      inventoryQuantity: row.inventory_quantity,
      imageFilename: row.image_filename,
      emoji: "🛒",
      vendorSlug: vendor.slug,
      vendorName: vendor.display_name,
    };
  });
}

export async function getActiveStoreVendors(): Promise<StoreVendor[]> {
  const products = await getActiveStoreProducts();
  return [...new Map(products.map((product) => [product.vendorSlug, { slug: product.vendorSlug, name: product.vendorName }])).values()];
}
