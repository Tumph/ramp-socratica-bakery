export type Product = {
  id: string;
  name: string;
  description: string;
  unit: string;
  priceCents: number;
  /** Maximum lifetime quantity a team may purchase. */
  perTeamLimit: number;
  /** Remaining global stock available to all teams. */
  inventoryQuantity: number;
  emoji: string;
  /** Filename in public/store/products, selected by an administrator. */
  imageFilename?: string;
};

/**
 * The workshop catalogue displayed by the market. Prices are expressed in
 * cents and remain server-owned when an order is created.
 */
export const catalog: Product[] = [
  { id: "flour", name: "Bread flour", description: "A 20 kg wholesale sack.", unit: "sack", priceCents: 4800, perTeamLimit: 4, inventoryQuantity: 24, emoji: "🌾", imageFilename: "flour.png" },
  { id: "butter", name: "Cultured butter", description: "A 5 kg bakery block.", unit: "block", priceCents: 7200, perTeamLimit: 4, inventoryQuantity: 24, emoji: "🧈", imageFilename: "butter.png" },
  { id: "chocolate", name: "Dark chocolate", description: "A 3 kg box of couverture.", unit: "box", priceCents: 6500, perTeamLimit: 4, inventoryQuantity: 24, emoji: "🍫", imageFilename: "chocolate.png" },
  { id: "eggs", name: "Free-run eggs", description: "A wholesale tray of 30.", unit: "tray", priceCents: 1800, perTeamLimit: 4, inventoryQuantity: 24, emoji: "🥚", imageFilename: "eggs.png" },
  { id: "boxes", name: "Pastry boxes", description: "Fifty recyclable boxes.", unit: "case", priceCents: 3200, perTeamLimit: 4, inventoryQuantity: 24, emoji: "📦", imageFilename: "boxes.png" },
  { id: "vanilla", name: "Vanilla paste", description: "One litre for the pastry bench.", unit: "bottle", priceCents: 5400, perTeamLimit: 4, inventoryQuantity: 24, emoji: "🌿", imageFilename: "vanilla.png" },
];

export const catalogById = new Map(catalog.map((product) => [product.id, product]));
