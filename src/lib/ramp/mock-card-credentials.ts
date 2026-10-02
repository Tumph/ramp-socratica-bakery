/**
 * Fake card credentials for the workshop simulator.
 *
 * AGENTS.md forbids storing a PAN, CVV or expiry, so nothing here is persisted:
 * the values are derived from the card id on demand and exist only in the
 * rendered component. Three properties make the output structurally incapable
 * of being a real payment card:
 *
 *   1. It starts with `1`. ISO/IEC 7812 assigns that major industry identifier
 *      to airlines; no card network issues under it.
 *   2. It deliberately FAILS the Luhn checksum, which every real card passes.
 *   3. The last four digits are the card's own display suffix, so the revealed
 *      number agrees with the masked one rather than inventing a new identity.
 *
 * Derivation is deterministic so the same card always shows the same digits
 * instead of reshuffling on every render.
 */

export type MockCardCredentials = {
  /** Grouped for display, e.g. "1111 1140 6828 8870". */
  number: string;
  /** MM/YY. */
  expiry: string;
  cvv: string;
};

function seedFrom(value: string) {
  // FNV-1a, enough for picking stable digits.
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash || 1;
}

function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard Luhn check — used here to guarantee the opposite. */
export function passesLuhn(digits: string) {
  const clean = digits.replace(/\D/g, "");
  if (!clean) return false;
  let sum = 0;
  let double = false;
  for (let i = clean.length - 1; i >= 0; i -= 1) {
    let digit = Number(clean[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

export function mockCardCredentials(cardId: string, displaySuffix: string): MockCardCredentials {
  const random = makeRandom(seedFrom(cardId));
  const digit = () => String(Math.floor(random() * 10));

  const suffix = displaySuffix.replace(/\D/g, "").padStart(4, "0").slice(-4);
  // "1" fixes the major industry identifier to airlines, never a card network.
  let body = `1${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}${digit()}`;

  // Force a Luhn failure. Nudging one digit flips the checksum.
  if (passesLuhn(body + suffix)) {
    const bumped = (Number(body[1]) + 1) % 10;
    body = body[0] + bumped + body.slice(2);
  }

  const raw = body + suffix;
  const number = raw.replace(/(.{4})/g, "$1 ").trim();

  const month = String(1 + Math.floor(random() * 12)).padStart(2, "0");
  const year = String((new Date().getFullYear() + 3 + Math.floor(random() * 3)) % 100).padStart(2, "0");
  const cvv = `${digit()}${digit()}${digit()}`;

  return { number, expiry: `${month}/${year}`, cvv };
}
