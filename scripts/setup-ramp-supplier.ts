import { loadEnvConfig } from "@next/env";
import { readFileSync, writeFileSync } from "node:fs";
import { rampRequest, rampBaseUrl } from "../src/lib/ramp";

async function main() {
  loadEnvConfig(process.cwd());
  process.env.RAMP_SCOPES = "vendors:read vendors:write entities:read";
  const name = "Socratica Bakery Supply (Sandbox Test)";
  let path: string | null = "/developer/v1/vendors?page_size=100";
  const matches: Array<{ id: string; name: string }> = [];
  while (path) {
    const page: { data: Array<{ id: string; name: string }>; page?: { next?: string } } = await rampRequest(path);
    matches.push(...page.data.filter(v => v.name === name));
    const next = page.page?.next;
    if (next) {
      const url = new URL(next);
      if (url.origin !== rampBaseUrl() || url.pathname !== "/developer/v1/vendors") throw new Error("Invalid pagination URL.");
      path = url.pathname + url.search;
    } else path = null;
  }
  if (matches.length > 1) throw new Error("Multiple test suppliers found; select one explicitly.");
  const vendor = matches[0] ?? await rampRequest<{ id: string; name: string }>("/developer/v1/vendors", {
    method: "POST", body: JSON.stringify({
      name, country: "CA", external_vendor_id: "socratica-bakery-sandbox-supplier",
      business_vendor_contacts: { email: "supplier@example.invalid", first_name: "Socratica", last_name: "Workshop" },
      request_payment_details: false, request_tax_details: false,
    }),
  });
  if (!vendor.id) throw new Error("Vendor ID missing; inspect Sandbox before retrying.");
  const env = readFileSync(".env.local", "utf8");
  const existing = process.env.RAMP_VENDOR_ID;
  if (existing && existing !== vendor.id) throw new Error("Existing supplier differs; not overwriting configuration.");
  writeFileSync(".env.local", /^RAMP_VENDOR_ID=/m.test(env) ? env.replace(/^RAMP_VENDOR_ID=.*$/m, `RAMP_VENDOR_ID=${vendor.id}`) : `${env}\nRAMP_VENDOR_ID=${vendor.id}\n`);
  console.log(`Configured ${name}: ${vendor.id}. No vendor information emails requested.`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
