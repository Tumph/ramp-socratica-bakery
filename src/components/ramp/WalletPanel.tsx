"use client";

import Link from "next/link";
import { useState } from "react";
import type { WalletCard } from "@/lib/ramp/types";
import { formatCardAmount, remainingFraction } from "@/lib/ramp/format";
import { walletCardsFor } from "@/lib/ramp/from-config";
import { useRampConfig } from "./RampConfigProvider";
import { CardDrawer } from "./CardDrawer";
import { RampButton } from "./RampButton";

function CardRowBody({ card }: { card: WalletCard }) {
  const remaining = remainingFraction(card.remainingCents, card.limitCents);
  const amount = `${formatCardAmount(card.remainingCents, card.currency)} left`;

  return (
    <>
      <span className="rampCardRowTop">
        <span className="rampCardName">{card.name}</span>
        <span className="rampCardAmount">{amount}</span>
      </span>
      {/* The track is always drawn; a card with no limit shows an empty one
          rather than omitting the rule. */}
      {remaining === null ? (
        <span className="rampProgress" aria-hidden />
      ) : (
        <span
          className="rampProgress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(remaining * 100)}
          aria-label={`${card.name} remaining`}
        >
          <span className="rampProgressFill" style={{ width: `${remaining * 100}%` }} />
        </span>
      )}
    </>
  );
}

function CardRow({ card, onOpen }: { card: WalletCard; onOpen: (id: string) => void }) {
  // A card carrying detail opens the drawer; one with only an href navigates.
  if (card.detail) {
    return (
      <li className="rampCardRowItem">
        <button type="button" className="rampCardRow" onClick={() => onOpen(card.id)}>
          <CardRowBody card={card} />
        </button>
      </li>
    );
  }

  return (
    <li className="rampCardRowItem">
      {card.href ? (
        <Link href={card.href} className="rampCardRow"><CardRowBody card={card} /></Link>
      ) : (
        <div className="rampCardRow"><CardRowBody card={card} /></div>
      )}
    </li>
  );
}

export function WalletPanel({
  title,
  viewAllHref,
}: {
  title: string;
  viewAllHref?: string;
}) {
  const { config } = useRampConfig();
  const cards = walletCardsFor(config);
  const [openId, setOpenId] = useState<string | null>(null);
  const openCard = cards.find((card) => card.id === openId) ?? null;

  return (
    <aside className="rampWallet">
      <div className="rampWalletActions">
        <RampButton variant="primary" iconAfter="chevron-down-16" block>New</RampButton>
        <RampButton iconBefore="wallet" block>My wallet</RampButton>
      </div>

      <div className="rampWalletList">
        <div className="rampWalletHead">
          <h2 className="rampWalletTitle">{title}</h2>
          {/* No href means the destination does not exist yet: inert, but still
              looks and focuses like the link. */}
          {viewAllHref ? (
            <Link href={viewAllHref} className="rampViewAll">
              <span>View all</span>
              {/* The design uses a text arrow at 11.2px, not an icon. */}
              <span className="rampViewAllArrow" aria-hidden>&rarr;</span>
            </Link>
          ) : (
            <button type="button" className="rampViewAll rampViewAll--inert" aria-disabled>
              <span>View all</span>
              <span className="rampViewAllArrow" aria-hidden>&rarr;</span>
            </button>
          )}
        </div>

        <ul className="rampCardRows">
          {cards.map((card) => (
            <CardRow key={card.id} card={card} onOpen={setOpenId} />
          ))}
        </ul>
      </div>

      {openCard && <CardDrawer card={openCard} onClose={() => setOpenId(null)} />}
    </aside>
  );
}
