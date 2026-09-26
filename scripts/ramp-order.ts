import { loadEnvConfig } from "@next/env";
import { getDatabase } from "../src/lib/db";
import { createOrder } from "../src/lib/orders";
import { syncRampOrder } from "../src/lib/ramp-sync";
import { rampRequest } from "../src/lib/ramp";

async function main() {
  loadEnvConfig(process.cwd());
  process.env.RAMP_MODE = "sandbox";
  const [action, id] = process.argv.slice(2);
  if (action === "sync" && id) {
    console.log(await syncRampOrder(id));
  } else if (action === "reconcile") {
    const rows = getDatabase().prepare(`SELECT o.id FROM orders o JOIN order_ramp_sync s ON s.order_id = o.id
      WHERE o.status != 'FULFILLED' ORDER BY o.created_at`).all() as Array<{ id: string }>;
    for (const row of rows) {
      try { console.log(row.id, await syncRampOrder(row.id)); }
      catch (error) { console.error(row.id, error instanceof Error ? error.message : "Synchronization failed."); process.exitCode = 1; }
    }
  } else if (action === "test" && id) {
    const entity = await rampRequest<{ id: string; entity_name: string }>(`/developer/v1/entities/${encodeURIComponent(id)}`);
    if (entity.id !== id) throw new Error("Entity mismatch.");
    const db = getDatabase();
    const teamId = "33333333-3333-4333-8333-333333333333";
    db.transaction(() => {
      db.prepare(`INSERT INTO teams (id, slug, name, starting_cash_cents, available_cash_cents)
        VALUES (?, 'integration-test', 'Integration Test Bakery', 100000, 100000) ON CONFLICT(id) DO NOTHING`).run(teamId);
      const current = db.prepare("SELECT ramp_entity_id FROM team_ramp_entities WHERE team_id = ?").get(teamId) as { ramp_entity_id: string } | undefined;
      if (current && current.ramp_entity_id !== id) throw new Error("Test team already uses another entity.");
      db.prepare("INSERT INTO team_ramp_entities (team_id, ramp_entity_id) VALUES (?, ?) ON CONFLICT(team_id) DO NOTHING").run(teamId, id);
    })();
    const previous = db.prepare("SELECT id FROM orders WHERE team_id = ? ORDER BY created_at DESC LIMIT 1").get(teamId) as { id: string } | undefined;
    console.log(`Test entity: ${entity.entity_name}`);
    console.log(previous ? await syncRampOrder(previous.id) : await createOrder(teamId, [{ productId: "eggs", quantity: 1 }]));
    console.log(db.prepare(`SELECT o.id, o.invoice_number, o.total_cents, o.status, o.error_message, s.draft_id, s.attachment_uploaded
      FROM orders o JOIN order_ramp_sync s ON s.order_id = o.id WHERE o.team_id = ?`).all(teamId));
  } else throw new Error("Usage: tsx scripts/ramp-order.ts test <entity-id> | sync <order-id> | reconcile");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
