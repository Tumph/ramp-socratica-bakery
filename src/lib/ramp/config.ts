import type { Viewer } from "./types";

/**
 * Simulator configuration.
 *
 * Shaped to match the tables this will eventually read from, so the Supabase
 * pass can replace the provider without touching components:
 *
 *   vendors        -> id, name, autofill_memo, logo_src
 *   vendor_products-> vendor_id, product_id
 *   team_cards     -> team_id, name, limit_cents, remaining_cents, suffix
 *
 * Held in localStorage for now so edits survive a reload during the workshop.
 */

export type Vendor = {
  id: string;
  name: string;
  /** Shown under the name on the market page. */
  blurb?: string;
  /** Prefills the Memo field on any expense from this vendor. */
  autofillMemo: string;
  logoSrc?: string;
  /** Ids from the bakery catalogue that this vendor sells. */
  productIds: string[];
};

export type TeamCard = {
  id: string;
  name: string;
  currency: string;
  limitCents: number;
  remainingCents: number;
  /** Last four digits only — never a full PAN. */
  displaySuffix: string;
};

export type TeamConfig = {
  id: string;
  name: string;
  viewer: Viewer;
  cards: TeamCard[];
};

export type SimulatorConfig = {
  vendors: Vendor[];
  teams: TeamConfig[];
  activeTeamId: string;
};

// Vendors mirror the market areas in the store design. Memos and product
// splits are placeholders, all editable from /admin.
export const defaultConfig: SimulatorConfig = {
  vendors: [
    {
      id: "aisle",
      name: "Aisle",
      blurb: "Non-perishables & essentials",
      autofillMemo: "Non-perishable baking supplies",
      productIds: ["flour", "boxes"],
    },
    {
      id: "fruits",
      name: "Fruits",
      blurb: "Fresh tasty berries & assorted produce",
      autofillMemo: "Fresh produce for the team bake",
      productIds: ["vanilla", "chocolate"],
    },
    {
      id: "fridge",
      name: "Fridge",
      blurb: "Anything that needs cold temps",
      autofillMemo: "Chilled dairy and eggs",
      productIds: ["butter", "eggs"],
    },
  ],

  teams: [
    {
      id: "making-dough",
      name: "Making Dough",
      viewer: { firstName: "Jack", initials: "JA" },
      cards: [
        { id: "socratica", name: "Ramp x Socratica - Making Dough", currency: "CAD", limitCents: 370_000, remainingCents: 130_000, displaySuffix: "8870" },
        { id: "f26", name: "F26 Sessions", currency: "CAD", limitCents: 189_459, remainingCents: 25_899, displaySuffix: "4412" },
      ],
    },
    {
      id: "rye-hard",
      name: "Rye Hard",
      viewer: { firstName: "Priya", initials: "PR" },
      cards: [
        { id: "rye-main", name: "Ramp x Socratica - Rye Hard", currency: "CAD", limitCents: 370_000, remainingCents: 298_400, displaySuffix: "5531" },
      ],
    },
    {
      id: "loaf-story",
      name: "Loaf Story",
      viewer: { firstName: "Sam", initials: "SA" },
      cards: [
        { id: "loaf-main", name: "Ramp x Socratica - Loaf Story", currency: "CAD", limitCents: 370_000, remainingCents: 41_250, displaySuffix: "7704" },
      ],
    },
  ],

  activeTeamId: "making-dough",
};

export function vendorForProduct(config: SimulatorConfig, productId: string) {
  return config.vendors.find((vendor) => vendor.productIds.includes(productId));
}

export function activeTeam(config: SimulatorConfig) {
  return config.teams.find((team) => team.id === config.activeTeamId) ?? config.teams[0];
}
