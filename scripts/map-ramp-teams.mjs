import Database from "better-sqlite3";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const [croissantEntity, sourdoughEntity] = process.argv.slice(2);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!uuid.test(croissantEntity ?? "") || !uuid.test(sourdoughEntity ?? "") || croissantEntity === sourdoughEntity) {
  throw new Error("Usage: node scripts/map-ramp-teams.mjs <croissant-entity-uuid> <sourdough-entity-uuid>; entities must be different.");
}
const base = process.env.RAMP_API_BASE_URL ?? "https://demo-api.ramp.com";
if (base !== "https://demo-api.ramp.com") throw new Error("This setup script requires the Sandbox API.");
let token = process.env.RAMP_ACCESS_TOKEN;
if (!token) {
  if (!process.env.RAMP_CLIENT_ID || !process.env.RAMP_CLIENT_SECRET) throw new Error("Missing Ramp client credentials.");
  const response = await fetch(`${base}/developer/v1/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${process.env.RAMP_CLIENT_ID}:${process.env.RAMP_CLIENT_SECRET}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials", scope: "entities:read" }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Ramp authentication failed (${response.status}).`);
  token = (await response.json()).access_token;
  if (!token) throw new Error("Missing access token in Ramp response.");
}
for (const id of [croissantEntity, sourdoughEntity]) {
  const response = await fetch(`${base}/developer/v1/entities/${id}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Cannot access entity ${id} (${response.status}). No mappings changed.`);
  const entity = await response.json();
  console.log(`Verified entity: ${entity.entity_name} (${id})`);
}
const database = new Database(process.env.DATABASE_PATH ?? "./data/bakery.db");
database.pragma("foreign_keys = ON");
try {
  database.transaction(() => {
    database.prepare(`INSERT INTO teams (id, slug, name, starting_cash_cents, available_cash_cents)
      VALUES ('22222222-2222-4222-8222-222222222222', 'team-sourdough', 'Team Sourdough Bakery', 100000, 100000)
      ON CONFLICT(slug) DO NOTHING`).run();
    database.prepare(`INSERT INTO team_codes (team_id, code)
      SELECT id, 'SOURDOUGH' FROM teams WHERE slug = 'team-sourdough'
      ON CONFLICT(team_id) DO NOTHING`).run();
    for (const [slug, entity] of [["team-croissant", croissantEntity], ["team-sourdough", sourdoughEntity]]) {
      const team = database.prepare("SELECT id FROM teams WHERE slug = ?").get(slug);
      if (!team) throw new Error("Run npm run db:init first.");
      const existing = database.prepare("SELECT ramp_entity_id FROM team_ramp_entities WHERE team_id = ?").get(team.id);
      if (existing && existing.ramp_entity_id !== entity) throw new Error(`${slug} already maps to a different entity; refusing to replace it.`);
      database.prepare("INSERT INTO team_ramp_entities (team_id, ramp_entity_id) VALUES (?, ?) ON CONFLICT(team_id) DO NOTHING").run(team.id, entity);
    }
  })();
  console.log("Both bakery teams mapped. Existing balances and orders preserved.");
} finally {
  database.close();
}
