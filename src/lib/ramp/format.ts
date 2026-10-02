// Ramp abbreviates large balances ("$400K left") but shows small ones in full
// ("258.99 CAD left"). These helpers reproduce that behaviour.

export function formatCardAmount(cents: number, currency: string) {
  const amount = cents / 100;
  const abs = Math.abs(amount);

  if (abs >= 1000) {
    const thousands = amount / 1000;
    // 1.3K, 400K — one decimal only when it adds information.
    const value = thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1);
    return currency === "USD" ? `$${value}K` : `${value}K ${currency}`;
  }

  const value = amount.toFixed(2);
  return currency === "USD" ? `$${value}` : `${value} ${currency}`;
}

/**
 * Fraction of the limit still available, clamped to 0–1.
 *
 * The bar fills with what is LEFT, not what was spent: the design's 1.3K-of-3.7K
 * card draws a 35.11% bar, which is the remaining share.
 */
export function remainingFraction(remainingCents: number, limitCents?: number) {
  if (!limitCents || limitCents <= 0) return null;
  return Math.min(1, Math.max(0, remainingCents / limitCents));
}

export function greetingFor(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
