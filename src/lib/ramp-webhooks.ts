import { createHmac, timingSafeEqual } from "node:crypto";
import { getDatabase } from "./db";
import { reconcileRampBill } from "./ramp-sync";

function equal(a: string, b: string) {
  const aa = Buffer.from(a); const bb = Buffer.from(b);
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
export function validRampSignature(raw: Uint8Array, signature: string | null, secret: string | undefined) {
  if (!secret || !signature) return false;
  const supplied = signature.replace(/^sha256=/, "");
  if (!/^[a-fA-F0-9]{64}$/.test(supplied)) return false;
  return equal(supplied.toLowerCase(), createHmac("sha256", secret).update(raw).digest("hex"));
}

export async function receiveRampWebhook(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer());
  if (raw.length > 1024 * 1024) return Response.json({ error: "Payload too large." }, { status: 413 });
  const signed = validRampSignature(raw, request.headers.get("x-ramp-signature"), process.env.RAMP_WEBHOOK_SECRET);
  // Setup challenge can arrive before the subscription's secret is returned. An independent
  // random header, configured on subscription creation, authenticates that handshake only.
  const setup = process.env.RAMP_WEBHOOK_SETUP_TOKEN;
  const setupValid = !!setup && equal(request.headers.get("x-bakery-webhook-setup") ?? "", setup);
  if (!signed && !setupValid) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let event: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    event = parsed as Record<string, unknown>;
  } catch { return Response.json({ error: "Invalid JSON object." }, { status: 400 }); }
  const db = getDatabase();
  if (event.type === "webhooks.verification" && typeof event.challenge === "string" && event.challenge.length <= 4096) {
    db.prepare("INSERT OR IGNORE INTO ramp_webhook_challenges (challenge) VALUES (?)").run(event.challenge);
    return Response.json({ received: true });
  }
  if (!signed) return Response.json({ error: "Signature required for business events." }, { status: 401 });
  if (typeof event.id !== "string" || !event.id || typeof event.type !== "string" || typeof event.business_id !== "string") {
    return Response.json({ error: "Malformed event." }, { status: 400 });
  }
  const expectedBusiness = process.env.RAMP_BUSINESS_ID;
  if (!expectedBusiness || event.business_id !== expectedBusiness) return Response.json({ error: "Unexpected business." }, { status: 403 });
  const headerId = request.headers.get("x-ramp-webhook-id");
  if (headerId && headerId !== event.id) return Response.json({ error: "Event ID mismatch." }, { status: 400 });
  const supported = ["bills.paid", "bills.created", "bills.approved", "bills.updated", "bills.rejected", "bills.archived", "tests.test_event"];
  if (!supported.includes(event.type)) return Response.json({ received: true, ignored: true });
  const object = event.object as { id?: unknown; object_id?: unknown } | null;
  const objectId = object?.id ?? object?.object_id;
  if (event.type !== "tests.test_event" && typeof objectId !== "string") return Response.json({ error: "Missing bill ID." }, { status: 400 });
  db.prepare(`INSERT OR IGNORE INTO webhook_events (ramp_event_id, event_type, business_id, object_id, payload)
    VALUES (?, ?, ?, ?, ?)`).run(event.id, event.type, event.business_id, typeof objectId === "string" ? objectId : null, Buffer.from(raw).toString("utf8"));
  // Durable inbox: acknowledge only after saving; the worker handles API reads and retries.
  return Response.json({ received: true });
}

let processing = false;
export async function processRampWebhookInbox() {
  if (processing) return [];
  processing = true;
  const results: Array<{ id: string; ok: boolean }> = [];
  try {
    const db = getDatabase();
    const events = db.prepare("SELECT ramp_event_id, event_type, object_id FROM webhook_events WHERE processed_at IS NULL ORDER BY created_at LIMIT 100")
      .all() as Array<{ ramp_event_id: string; event_type: string; object_id: string | null }>;
    for (const event of events) {
      try {
        if (event.event_type !== "tests.test_event") {
          if (!event.object_id) throw new Error("Missing bill ID.");
          await reconcileRampBill(event.object_id);
        }
        db.prepare("UPDATE webhook_events SET processed_at = CURRENT_TIMESTAMP, processing_result = 'ok' WHERE ramp_event_id = ?").run(event.ramp_event_id);
        results.push({ id: event.ramp_event_id, ok: true });
      } catch (error) {
        db.prepare("UPDATE webhook_events SET processing_result = ? WHERE ramp_event_id = ?").run(error instanceof Error ? error.message : "Processing failed.", event.ramp_event_id);
        results.push({ id: event.ramp_event_id, ok: false });
      }
    }
    return results;
  } finally { processing = false; }
}
