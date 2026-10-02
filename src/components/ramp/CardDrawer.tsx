"use client";

import { useEffect, useRef, useState } from "react";
import type { WalletCard } from "@/lib/ramp/types";
import { formatCardAmount, remainingFraction } from "@/lib/ramp/format";
import { CardFace } from "./CardFace";
import { CopyButton } from "./CopyButton";
import { RampIcon } from "./RampIcon";

const TABS = ["Overview", "Activity"];

function fullAmount(cents: number, currency: string) {
  return `${(cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function WhatsIssued({ facts }: { facts: { icon: Parameters<typeof RampIcon>[0]["name"]; label: string }[] }) {
  const [open, setOpen] = useState(true);
  return (
    <section className="rampIssued">
      <button
        type="button"
        className="rampIssuedToggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <RampIcon name="chevron-down-16" className={open ? "" : "rampIcon--collapsed"} />
        <span>What&rsquo;s issued?</span>
      </button>
      {open && (
        <ul className="rampIssuedList">
          {facts.map((fact) => (
            <li key={fact.label}>
              <RampIcon name={fact.icon} />
              <span>{fact.label}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function CardDrawer({ card, onClose }: { card: WalletCard; onClose: () => void }) {
  const [tab, setTab] = useState(TABS[0]);
  const panel = useRef<HTMLDivElement>(null);

  // Escape closes, and focus moves into the panel so the drawer is keyboard-usable.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    panel.current?.focus();
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const detail = card.detail;
  if (!detail) return null;

  const limit = card.limitCents ?? card.remainingCents;
  const spent = Math.max(0, limit - card.remainingCents);
  const remaining = remainingFraction(card.remainingCents, card.limitCents) ?? 1;

  return (
    <div className="rampDrawerBackdrop" onClick={onClose}>
      <div
        ref={panel}
        className="rampDrawer"
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rampDrawerClose" onClick={onClose} aria-label="Close">
          <RampIcon name="close" />
        </button>

        <header className="rampDrawerHead">
          <div className="rampDrawerTitleRow">
            <img className="rampDrawerAvatar" src="/ramp/icons/card-avatar.svg" alt="" aria-hidden />
            <div className="rampDrawerTitleText">
              <h1 className="rampDrawerTitle">{card.name}</h1>
              {detail.requestHref && (
                <a className="rampDrawerSubLink" href={detail.requestHref}>View request</a>
              )}
            </div>
            <button type="button" className="rampBtn rampBtn--secondary rampDrawerActions">
              <span>Actions</span>
              <RampIcon name="chevron-down-16" />
            </button>
          </div>

          <div className="rampTabs" role="tablist">
            {TABS.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={tab === name ? "rampTab rampTab--active" : "rampTab"}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
          </div>
        </header>

        <div className="rampDrawerBody">
          {tab === "Overview" ? (
            <>
              <section className="rampSpendPanel">
                <div className="rampSpendRow">
                  <p className="rampSpendFigure">
                    <strong>{fullAmount(spent, card.currency)}</strong> <span>spent</span>
                  </p>
                  <p className="rampSpendFigure rampSpendFigure--right">
                    <strong>{fullAmount(card.remainingCents, card.currency)}</strong> <span>left</span>
                  </p>
                </div>

                <span className="rampSpendBar" role="progressbar" aria-valuemin={0} aria-valuemax={100}
                  aria-valuenow={Math.round(remaining * 100)} aria-label={`${card.name} remaining`}>
                  <span className="rampSpendBarFill" style={{ width: `${remaining * 100}%` }} />
                </span>

                <div className="rampSpendFoot">
                  <p>
                    Need more funds? <a href={detail.requestHref ?? "#"}>Request an increase.</a>
                  </p>
                  <p>{fullAmount(limit, card.currency)} total</p>
                </div>

                <div className="rampCardBlock">
                  <CardFace cardId={card.id} detail={detail} />
                  <dl className="rampCardMeta">
                    <dt>Name on card</dt>
                    <dd>
                      <span>{detail.nameOnCard}</span>
                      <CopyButton value={detail.nameOnCard} label="name on card" />
                    </dd>
                    <dt>Billing address</dt>
                    {detail.billingAddress.map((line) => (
                      <dd key={line}>
                        <span>{line}</span>
                        <CopyButton value={line} label="billing address line" />
                      </dd>
                    ))}
                  </dl>
                </div>
              </section>

              <WhatsIssued facts={detail.issued} />

              <section className="rampPolicies">
                <h2 className="rampDrawerSectionTitle">Policies</h2>
                <div className="rampPolicyPanel">Card transactions</div>
              </section>
            </>
          ) : (
            <p className="rampEmpty">There&rsquo;s nothing here yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
