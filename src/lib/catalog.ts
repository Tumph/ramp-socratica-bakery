export type Product = {
  id: string;
  name: string;
  description: string;
  unit: string;
  priceCents: number;
  emoji: string;
};

export type Vendor = {
  /** Stable identifier shared by the storefront route, API, and database. */
  slug: string;
  name: string;
  invoicePrefix: string;
  catalog: Product[];
};

/**
 * The deployment-level store registry. A frontend redesign must add each
 * store's slug, display name, invoice prefix, and server-owned catalogue here,
 * then seed the matching slug in `vendors` through a migration.
 */
export const vendors: Vendor[] = [];
export const vendorsBySlug = new Map(vendors.map((vendor) => [vendor.slug, vendor]));

export function getVendor(slug: string) {
  return vendorsBySlug.get(slug);
}
