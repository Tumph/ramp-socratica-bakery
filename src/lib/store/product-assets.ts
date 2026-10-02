/**
 * The Worker cannot read the deployment filesystem at runtime. Keep this
 * reviewed manifest in sync with `public/store/products/` as art is added.
 */
export const productImageAssets = [
  "boxes.png",
  "butter.png",
  "chocolate.png",
  "eggs.png",
  "flour.png",
  "vanilla.png",
] as const;

export type ProductImageAsset = (typeof productImageAssets)[number];

export function isProductImageAsset(value: string): value is ProductImageAsset {
  return productImageAssets.includes(value as ProductImageAsset);
}
