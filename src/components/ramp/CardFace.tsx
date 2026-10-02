"use client";

import { useMemo, useState } from "react";
import type { CardDetail } from "@/lib/ramp/types";
import { mockCardCredentials } from "@/lib/ramp/mock-card-credentials";
import { CopyButton } from "./CopyButton";
import { RampIcon } from "./RampIcon";

/**
 * Card artwork. When the card is revealable it flips to show simulator-only
 * credentials, generated on demand and never stored (see mock-card-credentials).
 */
export function CardFace({ cardId, detail }: { cardId: string; detail: CardDetail }) {
  const [revealed, setRevealed] = useState(false);
  const credentials = useMemo(
    () => mockCardCredentials(cardId, detail.displaySuffix),
    [cardId, detail.displaySuffix],
  );

  const front = (
    <div className="rampCardFaceSide rampCardFaceSide--front">
      <div className="rampCardFaceTop">
        <img className="rampCardFaceLogo" src="/ramp/card/ramp-wordmark.svg" alt="Ramp" />
        <img className="rampCardFaceVisa" src="/ramp/card/visa.svg" alt="Visa Signature Business" />
      </div>
      <div className="rampCardFaceBottom">
        <span className="rampCardFaceNumber">···· ···· ···· {detail.displaySuffix}</span>
      </div>
    </div>
  );

  if (!detail.revealable) {
    return <div className="rampCardFace">{front}</div>;
  }

  return (
    <div className={revealed ? "rampCardFlip rampCardFlip--revealed" : "rampCardFlip"}>
      <div className="rampCardFlipInner">
        <button
          type="button"
          className="rampCardFace rampCardFace--button"
          onClick={() => setRevealed(true)}
          aria-label="Reveal card details"
          tabIndex={revealed ? -1 : 0}
        >
          {front}
          <span className="rampCardHint">Click to reveal card details</span>
        </button>

        {/* The whole back flips closed, matching the front's click-to-reveal. */}
        <div
          className="rampCardFace rampCardFace--back"
          aria-hidden={!revealed}
          onClick={() => setRevealed(false)}
        >
          <div className="rampCardFaceSide">
            <div className="rampCardBackTop">
              <p className="rampCardBackNumber">
                <span>{credentials.number}</span>
                <CopyButton value={credentials.number.replace(/\s/g, "")} label="card number" />
              </p>
              <div className="rampCardBackRow">
                <div>
                  <span className="rampCardBackLabel">EXP</span>
                  <p className="rampCardBackValue">
                    <span>{credentials.expiry}</span>
                    <CopyButton value={credentials.expiry} label="expiry" />
                  </p>
                </div>
                <div>
                  <span className="rampCardBackLabel">CVV</span>
                  <p className="rampCardBackValue">
                    <span>{credentials.cvv}</span>
                    <CopyButton value={credentials.cvv} label="CVV" />
                  </p>
                </div>
              </div>
            </div>
            <div className="rampCardFaceBottom rampCardFaceBottom--back">
              <button
                type="button"
                className="rampCardHide"
                onClick={() => setRevealed(false)}
                aria-label="Hide card details"
                tabIndex={revealed ? 0 : -1}
              >
                <RampIcon name="eye-off" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
