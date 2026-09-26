export type Product = {
  id: string;
  name: string;
  description: string;
  unit: string;
  priceCents: number;
  emoji: string;
};

export const catalog: Product[] = [
  { id: "flour", name: "Bread flour", description: "A 20 kg wholesale sack.", unit: "sack", priceCents: 4800, emoji: "🌾" },
  { id: "butter", name: "Cultured butter", description: "A 5 kg bakery block.", unit: "block", priceCents: 7200, emoji: "🧈" },
  { id: "chocolate", name: "Dark chocolate", description: "A 3 kg box of couverture.", unit: "box", priceCents: 6500, emoji: "🍫" },
  { id: "eggs", name: "Free-run eggs", description: "A wholesale tray of 30.", unit: "tray", priceCents: 1800, emoji: "🥚" },
  { id: "boxes", name: "Pastry boxes", description: "Fifty recyclable boxes.", unit: "case", priceCents: 3200, emoji: "📦" },
  { id: "vanilla", name: "Vanilla paste", description: "One litre for the pastry bench.", unit: "bottle", priceCents: 5400, emoji: "🌿" },
];

export const catalogById = new Map(catalog.map((product) => [product.id, product]));
