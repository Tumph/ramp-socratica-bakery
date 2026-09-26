import fs from "node:fs/promises";
import path from "node:path";
import Database from "better-sqlite3";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());

const databasePath = path.resolve(process.env.DATABASE_PATH ?? "./data/bakery.db");
await fs.mkdir(path.dirname(databasePath), { recursive: true });

const sql = await fs.readFile(new URL("../sql/schema.sql", import.meta.url), "utf8");
const database = new Database(databasePath);
database.pragma("journal_mode = WAL");
database.exec(sql);
// CREATE TABLE IF NOT EXISTS does not add columns to databases made by an older
// version of the prototype. Keep this migration idempotent for local event data.
const userColumns = database.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "role")) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'PARTICIPANT'");
}
database.close();
console.log(`Database initialized at ${databasePath}`);
