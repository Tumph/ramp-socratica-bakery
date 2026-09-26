import path from "node:path";
import Database from "better-sqlite3";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
  throw new Error("Usage: npm run facilitator:grant -- facilitator@example.com");
}

const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "bakery.db");
const database = new Database(databasePath);
try {
  const result = database.prepare("UPDATE users SET role = 'FACILITATOR' WHERE email = ?").run(email);
  if (result.changes !== 1) throw new Error("No verified account exists for that email. Sign up first, then grant facilitator access.");
  console.log(`Facilitator access granted to ${email}.`);
} finally {
  database.close();
}
