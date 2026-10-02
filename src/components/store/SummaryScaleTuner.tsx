"use client";

import { useEffect, useState } from "react";

/**
 * Dev-only sliders for dialling in the checkout columns by eye.
 *
 * Both write CSS variables the stylesheet already reads. Type is deliberately
 * NOT scaled — it stays on the shared type scale — so only dimensions move.
 */
export function SummaryScaleTuner() {
  const [cart, setCart] = useState(0.85);
  const [summary, setSummary] = useState(0.85);

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--checkout-cart-scale", String(cart));
    root.setProperty("--checkout-summary-scale", String(summary));
  }, [cart, summary]);

  if (process.env.NODE_ENV !== "development") return null;

  const css = `.checkoutCart { --c: ${cart}; }\n.checkoutSummary { --s: ${summary}; }`;

  return (
    <div className="storeTuner">
      <label>
        <span>Cart scale</span>
        <input type="range" min={0.6} max={1.2} step={0.01} value={cart}
          onChange={(event) => setCart(Number(event.target.value))} />
        <output>{cart.toFixed(2)}</output>
      </label>
      <label>
        <span>Summary scale</span>
        <input type="range" min={0.6} max={1.2} step={0.01} value={summary}
          onChange={(event) => setSummary(Number(event.target.value))} />
        <output>{summary.toFixed(2)}</output>
      </label>
      <div className="storeTunerFoot">
        <code>{`--c: ${cart} / --s: ${summary}`}</code>
        <button type="button" onClick={() => navigator.clipboard?.writeText(css).catch(() => {})}>
          Copy
        </button>
        <button type="button" onClick={() => { setCart(1); setSummary(1); }}>Reset</button>
      </div>
    </div>
  );
}
