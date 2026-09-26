import { loadEnvConfig } from "@next/env";
import { processRampWebhookInbox } from "../src/lib/ramp-webhooks";
import { getDatabase } from "../src/lib/db";
import { syncRampOrder } from "../src/lib/ramp-sync";

async function main() {
  loadEnvConfig(process.cwd());
  process.env.RAMP_MODE = "sandbox";
  let stopping = false;
  process.on("SIGINT", () => { stopping = true; });
  process.on("SIGTERM", () => { stopping = true; });
  do {
    const results = await processRampWebhookInbox();
    if (results.length) console.log(`Webhook inbox: ${results.filter(r => r.ok).length} processed, ${results.filter(r => !r.ok).length} pending retry.`);
    const pending = getDatabase().prepare(`SELECT o.id FROM orders o JOIN order_ramp_sync s ON s.order_id = o.id
      WHERE o.status != 'FULFILLED' ORDER BY o.updated_at LIMIT 100`).all() as Array<{ id: string }>;
    for (const order of pending) {
      if (stopping) break;
      try { await syncRampOrder(order.id); }
      catch (error) { console.error(order.id, error instanceof Error ? error.message : "Reconciliation failed."); }
    }
    if (process.argv.includes("--once") || stopping) break;
    await new Promise(resolve => setTimeout(resolve, 15_000));
  } while (!stopping);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
