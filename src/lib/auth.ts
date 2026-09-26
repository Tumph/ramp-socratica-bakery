import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabase } from "./db";

const SESSION_COOKIE = "bakery_session";
const CODE_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type CurrentUser = {
  id: string;
  email: string;
  teamId: string;
  teamName: string;
  teamSlug: string;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function codeHash(id: string, email: string, code: string) {
  const pepper = process.env.AUTH_CODE_PEPPER ?? "local-development-pepper";
  return sha256(`${id}:${email}:${code}:${pepper}`);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function requestVerificationCode(input: {
  email: string;
  purpose: "SIGNUP" | "LOGIN";
  teamCode?: string;
}) {
  const database = getDatabase();
  const email = normalizeEmail(input.email);
  const now = Math.floor(Date.now() / 1000);
  let teamId: string | null = null;

  const recent = database.prepare(`
    SELECT COUNT(*) AS count FROM verification_codes
    WHERE email = ? AND created_at > ?
  `).get(email, now - 15 * 60) as { count: number };
  if (recent.count >= 5) throw new Error("Too many codes requested. Try again in 15 minutes.");

  if (input.purpose === "SIGNUP") {
    const existing = database.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) throw new Error("This email already has an account. Choose Log in instead.");
    const team = database.prepare(`
      SELECT t.id FROM teams t JOIN team_codes tc ON tc.team_id = t.id WHERE tc.code = ?
    `).get(input.teamCode?.trim() ?? "") as { id: string } | undefined;
    if (!team) throw new Error("That team code is not valid.");
    teamId = team.id;
  } else {
    const user = database.prepare("SELECT team_id FROM users WHERE email = ?").get(email) as
      | { team_id: string }
      | undefined;
    if (!user) throw new Error("No account exists for this email. Choose Create account instead.");
    teamId = user.team_id;
  }

  const id = randomUUID();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  database.prepare(`
    INSERT INTO verification_codes
      (id, email, purpose, team_id, code_hash, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, email, input.purpose, teamId, codeHash(id, email, code), now + CODE_TTL_SECONDS, now);

  await sendVerificationEmail(email, code);
  return {
    email,
    expiresInSeconds: CODE_TTL_SECONDS,
    developmentCode: process.env.NODE_ENV === "production" ? undefined : code,
  };
}

async function sendVerificationEmail(email: string, code: string) {
  if ((process.env.EMAIL_MODE ?? "console") === "console" && process.env.NODE_ENV !== "production") {
    console.log(`[development email] ${email}: your Socratica Bakery code is ${code}`);
    return;
  }
  throw new Error("A production email provider has not been configured yet.");
}

export function verifyCodeAndCreateSession(emailInput: string, code: string) {
  const database = getDatabase();
  const email = normalizeEmail(emailInput);
  const now = Math.floor(Date.now() / 1000);
  const verification = database.prepare(`
    SELECT id, purpose, team_id, code_hash, expires_at, attempts
    FROM verification_codes
    WHERE email = ? AND used_at IS NULL
    ORDER BY created_at DESC LIMIT 1
  `).get(email) as
    | { id: string; purpose: "SIGNUP" | "LOGIN"; team_id: string; code_hash: string; expires_at: number; attempts: number }
    | undefined;

  if (!verification || verification.expires_at < now) throw new Error("That code has expired. Request a new one.");
  if (verification.attempts >= 5) throw new Error("Too many incorrect attempts. Request a new code.");

  const suppliedHash = codeHash(verification.id, email, code);
  const valid = timingSafeEqual(Buffer.from(suppliedHash), Buffer.from(verification.code_hash));
  if (!valid) {
    database.prepare("UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?").run(verification.id);
    throw new Error("That verification code is incorrect.");
  }

  const result = database.transaction(() => {
    let user = database.prepare("SELECT id, team_id FROM users WHERE email = ?").get(email) as
      | { id: string; team_id: string }
      | undefined;
    if (!user && verification.purpose === "SIGNUP") {
      user = { id: randomUUID(), team_id: verification.team_id };
      database.prepare(
        "INSERT INTO users (id, email, team_id, verified_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)"
      ).run(user.id, email, user.team_id);
    }
    if (!user) throw new Error("Account not found.");

    database.prepare("UPDATE verification_codes SET used_at = CURRENT_TIMESTAMP WHERE id = ?").run(verification.id);
    const token = randomBytes(32).toString("base64url");
    database.prepare(
      "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)"
    ).run(randomUUID(), user.id, sha256(token), now + SESSION_TTL_SECONDS);
    return { token, expiresAt: new Date((now + SESSION_TTL_SECONDS) * 1000) };
  })();

  return result;
}

export function sessionCookie(token: string, expires: Date) {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    },
  };
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const now = Math.floor(Date.now() / 1000);
  const user = getDatabase().prepare(`
    SELECT u.id, u.email, u.team_id AS teamId, t.name AS teamName, t.slug AS teamSlug
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    JOIN teams t ON t.id = u.team_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(sha256(token), now) as CurrentUser | undefined;
  return user ?? null;
}

export async function deleteCurrentSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) getDatabase().prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export const sessionCookieName = SESSION_COOKIE;
