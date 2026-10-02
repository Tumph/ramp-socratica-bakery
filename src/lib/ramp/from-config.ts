import { activeTeam, type SimulatorConfig, type TeamCard } from "./config";
import type { CardDetail, WalletCard } from "./types";

/**
 * Projects the simulator config into the view-model the Ramp components
 * already take. When this moves to Supabase only the input changes.
 */

const BILLING_ADDRESS = ["28 W 23rd St, Floor 2", "New York, NY, US", "10010"];

function detailFor(card: TeamCard, cardholder: string, index: number): CardDetail {
  return {
    displaySuffix: card.displaySuffix,
    // Only the first card is revealable, matching the current build.
    revealable: index === 0,
    nameOnCard: cardholder,
    billingAddress: BILLING_ADDRESS,
    networkTier: "Signature Business",
    requestHref: "#",
    issued: [
      { icon: "issued-amount", label: `$${(card.limitCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} total` },
      { icon: "issued-card", label: "Virtual card-only" },
      { icon: "issued-people", label: "Not shareable with other employees" },
    ],
  };
}

export function walletCardsFor(config: SimulatorConfig): WalletCard[] {
  const team = activeTeam(config);
  const cardholder = `${team.viewer.firstName} ${team.name}`.trim();
  return team.cards.map((card, index) => ({
    id: card.id,
    name: card.name,
    currency: card.currency,
    remainingCents: card.remainingCents,
    limitCents: card.limitCents,
    detail: detailFor(card, cardholder, index),
  }));
}

export function viewerFor(config: SimulatorConfig) {
  return activeTeam(config).viewer;
}
