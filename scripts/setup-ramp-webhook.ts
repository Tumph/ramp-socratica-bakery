import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createAdminClient } from "../src/lib/supabase/admin";
import { rampRequest } from "../src/lib/ramp";

function save(key: string, value: string) {
  const env = readFileSync(".env.local", "utf8");
  writeFileSync(".env.local", new RegExp(`^${key}=`, "m").test(env) ? env.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`) : `${env}\n${key}=${value}\n`);
  process.env[key] = value;
}
async function main() {
  loadEnvConfig(process.cwd());
  const endpoint = process.argv[2];
  if (!endpoint || new URL(endpoint).protocol !== "https:" || new URL(endpoint).pathname !== "/api/webhooks/ramp") throw new Error("Pass the HTTPS /api/webhooks/ramp URL.");
  if (process.env.RAMP_WEBHOOK_ID) throw new Error("A subscription is already configured. Remove it explicitly before replacing it.");
  const setup = randomBytes(32).toString("hex");
  save("RAMP_WEBHOOK_SETUP_TOKEN", setup);
  const admin = createAdminClient();
  await admin.from("ramp_webhook_challenges").delete().neq("challenge", "");
  const subscription = await rampRequest<{ id: string; secret: string; business_id: string }>("/developer/v1/webhooks", {
    method: "POST", body: JSON.stringify({ endpoint_url: endpoint,
      event_types: ["bills.paid", "bills.created", "bills.approved", "bills.updated", "bills.rejected", "bills.archived", "tests.test_event"],
      additional_headers: { "X-Bakery-Webhook-Setup": setup },
    }),
  });
  save("RAMP_WEBHOOK_ID", subscription.id);
  save("RAMP_WEBHOOK_SECRET", subscription.secret);
  if (subscription.business_id) save("RAMP_BUSINESS_ID", subscription.business_id);
  save("RAMP_WEBHOOK_URL", endpoint);
  console.log(`Created subscription ${subscription.id}; secret saved locally.`);
  let challenge: { challenge: string } | undefined;
  for (let i = 0; i < 30; i++) {
    const result = await admin.from("ramp_webhook_challenges").select("challenge").order("received_at", { ascending: false }).limit(1).maybeSingle();
    challenge = result.data ?? undefined;
    if (challenge) break;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (!challenge) throw new Error("No verification challenge received. Subscription saved but not active; inspect receiver and verify before using it.");
  await rampRequest(`/developer/v1/webhooks/${subscription.id}/verify`, { method: "POST", body: JSON.stringify({ challenge: challenge.challenge }) });
  console.log("Subscription verified and active.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
