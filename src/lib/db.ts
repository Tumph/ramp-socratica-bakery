import Database from "better-sqlite3";
import path from "node:path";

const globalForDatabase = globalThis as unknown as { bakeryDatabase?: Database.Database };

export function getDatabase() {
  if (!globalForDatabase.bakeryDatabase) {
    const databasePath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "data", "bakery.db");
    const database = new Database(databasePath);
    database.pragma("foreign_keys = ON");
    database.pragma("journal_mode = WAL");
    globalForDatabase.bakeryDatabase = database;
  }

  return globalForDatabase.bakeryDatabase;
}
