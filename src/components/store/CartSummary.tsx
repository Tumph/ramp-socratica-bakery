"use client";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export function CartSummary({
  subtotalCents,
  totalCents,
  onPayWithRamp,
  disabled,
}: {
  subtotalCents: number;
  totalCents: number;
  onPayWithRamp?: () => void;
  disabled?: boolean;
}) {
  return (
    <aside className="checkoutSummary">
      <h2 className="storeDisplay">Summary</h2>

      <dl className="checkoutTotals">
        <div className="checkoutSubtotal">
          <dt>Subtotal</dt>
          <dd>{money(subtotalCents)}</dd>
        </div>
        <div className="checkoutTotal">
          <dt>Total</dt>
          <dd>{money(totalCents)}</dd>
        </div>
      </dl>

      <button type="button" className="checkoutRamp" onClick={onPayWithRamp} disabled={disabled}>
        <span className="checkoutRampMark" aria-label="Pay with Ramp">
          <img src="/ramp/logo-wordmark.svg" alt="" aria-hidden />
          <img src="/ramp/logo-mark.svg" alt="" aria-hidden />
        </span>
      </button>

      <button type="button" className="checkoutAltPay">Add credit card instead</button>
    </aside>
  );
}
