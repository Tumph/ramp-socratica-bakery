import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Password gate for /admin.
 *
 * Server-side only: the cookie holds a hash derived from the configured
 * password, never the password itself, and is verified on every render. The
 * password lives in RAMP_ADMIN_PASSWORD — deliberately not NEXT_PUBLIC_, so it
 * is never shipped to the browser.
 *
 * Fails closed: with no password configured, nobody gets in.
 */

export const ADMIN_COOKIE = "ramp_admin";

function tokenFor(password: string) {
  return createHash("sha256").update(`ramp-admin-v1:${password}`).digest("hex");
}

export function adminPasswordConfigured() {
  return Boolean(process.env.RAMP_ADMIN_PASSWORD);
}

/** Constant-time compare so a wrong guess cannot be timed character by character. */
function equals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function checkPassword(candidate: string) {
  const expected = process.env.RAMP_ADMIN_PASSWORD;
  if (!expected) return null;
  if (!equals(candidate, expected)) return null;
  return tokenFor(expected);
}

export async function isAdminAuthed() {
  const expected = process.env.RAMP_ADMIN_PASSWORD;
  if (!expected) return false;
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  return equals(token, tokenFor(expected));
}
