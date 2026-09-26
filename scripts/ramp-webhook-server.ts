import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { loadEnvConfig } from "@next/env";
import { receiveRampWebhook } from "../src/lib/ramp-webhooks";

loadEnvConfig(process.cwd());
// Expose only the webhook handler through a development tunnel, not the console email UI.
const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/api/webhooks/ramp") { res.writeHead(404).end(); return; }
  try {
    // Pick up the subscription secret written after the verification callback begins.
    const env = readFileSync(".env.local", "utf8");
    for (const key of ["RAMP_WEBHOOK_SECRET", "RAMP_WEBHOOK_SETUP_TOKEN", "RAMP_BUSINESS_ID"]) {
      const match = env.match(new RegExp(`^${key}=(.*)$`, "m"));
      if (match) process.env[key] = match[1].trim().replace(/^['"]|['"]$/g, "");
    }
    const chunks: Buffer[] = []; let length = 0;
    for await (const chunk of req) {
      length += chunk.length;
      if (length > 1024 * 1024) { res.writeHead(413).end(); return; }
      chunks.push(Buffer.from(chunk));
    }
    const headers = new Headers();
    for (const [key, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(key, value);
    const response = await receiveRampWebhook(new Request("http://localhost/api/webhooks/ramp", { method: "POST", headers, body: Buffer.concat(chunks) }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
    console.log(`Webhook HTTP ${response.status}`);
  } catch {
    res.writeHead(500).end(); console.error("Webhook request failed.");
  }
});
server.listen(3901, "127.0.0.1", () => console.log("Webhook-only server listening on 127.0.0.1:3901"));
