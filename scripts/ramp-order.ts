import { loadEnvConfig } from "@next/env";
import { createAdminClient } from "../src/lib/supabase/admin";
import { syncRampOrder } from "../src/lib/ramp-sync";

async function main() {
  loadEnvConfig(process.cwd()); const [action, id] = process.argv.slice(2);
  if (action === "sync" && id) { console.log(await syncRampOrder(id)); return; }
  if (action !== "reconcile") throw new Error("Usage: tsx scripts/ramp-order.ts sync <order-id> | reconcile");
  const { data: orders, error } = await createAdminClient().from("orders").select("id").neq("status", "FULFILLED").order("created_at"); if (error) throw error;
  for (const order of orders ?? []) try { console.log(order.id, await syncRampOrder(order.id)); } catch (caught) { console.error(order.id, caught instanceof Error ? caught.message : "Synchronization failed."); process.exitCode = 1; }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
