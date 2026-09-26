import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { rampRequest } from "../src/lib/ramp";

async function main() {
  loadEnvConfig(process.cwd());
  const id = process.env.RAMP_WEBHOOK_ID;
  if (!id) throw new Error("No configured webhook subscription to remove.");
  await rampRequest(`/developer/v1/webhooks/${encodeURIComponent(id)}`, { method: "DELETE" });
  const keys = ["RAMP_WEBHOOK_ID", "RAMP_WEBHOOK_SECRET", "RAMP_WEBHOOK_SETUP_TOKEN", "RAMP_WEBHOOK_URL"];
  const env = readFileSync(".env.local", "utf8").split("\n").map(line => {
    const key = line.split("=", 1)[0];
    return keys.includes(key) ? `${key}=` : line;
  }).join("\n");
  writeFileSync(".env.local", env);
  console.log(`Removed temporary subscription ${id} and cleared its local secrets.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
