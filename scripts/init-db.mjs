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
database.close();
console.log(`Database initialized at ${databasePath}`);
