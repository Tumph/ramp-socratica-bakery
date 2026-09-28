import { createHmac, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "./supabase/admin";

function equal(a: string, b: string) { const aa = Buffer.from(a); const bb = Buffer.from(b); return aa.length === bb.length && timingSafeEqual(aa, bb); }
export function validRampSignature(raw: Uint8Array, signature: string | null, secret: string | undefined) {
  if (!secret || !signature) return false; const supplied = signature.replace(/^sha256=/, "");
  return /^[a-fA-F0-9]{64}$/.test(supplied) && equal(supplied.toLowerCase(), createHmac("sha256", secret).update(raw).digest("hex"));
}
export async function receiveRampWebhook(request: Request) {
  const raw = new Uint8Array(await request.arrayBuffer()); if (raw.length > 1024 * 1024) return Response.json({ error: "Payload too large." }, { status: 413 });
  const signed = validRampSignature(raw, request.headers.get("x-ramp-signature"), process.env.RAMP_WEBHOOK_SECRET); const setup = process.env.RAMP_WEBHOOK_SETUP_TOKEN;
  if (!signed && !(setup && equal(request.headers.get("x-bakery-webhook-setup") ?? "", setup))) return Response.json({ error: "Invalid webhook signature." }, { status: 401 });
  let event: Record<string, unknown>; try { const parsed: unknown = JSON.parse(Buffer.from(raw).toString("utf8")); if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error(); event = parsed as Record<string, unknown>; } catch { return Response.json({ error: "Invalid JSON object." }, { status: 400 }); }
  const admin = createAdminClient();
  if (event.type === "webhooks.verification" && typeof event.challenge === "string" && event.challenge.length <= 4096) { await admin.from("ramp_webhook_challenges").upsert({ challenge: event.challenge }, { onConflict: "challenge", ignoreDuplicates: true }); return Response.json({ received: true }); }
  if (!signed || typeof event.id !== "string" || !event.id || typeof event.type !== "string" || typeof event.business_id !== "string") return Response.json({ error: "Malformed event." }, { status: 400 });
  if (!process.env.RAMP_BUSINESS_ID || event.business_id !== process.env.RAMP_BUSINESS_ID) return Response.json({ error: "Unexpected business." }, { status: 403 });
  const object = event.object as { id?: unknown; object_id?: unknown } | null; const objectId = object?.id ?? object?.object_id;
  const supported = ["bills.paid", "bills.created", "bills.approved", "bills.updated", "bills.rejected", "bills.archived", "tests.test_event"];
  if (!supported.includes(event.type)) return Response.json({ received: true, ignored: true }); if (event.type !== "tests.test_event" && typeof objectId !== "string") return Response.json({ error: "Missing bill ID." }, { status: 400 });
  const { error } = await admin.from("webhook_events").upsert({ ramp_event_id: event.id, event_type: event.type, business_id: event.business_id, object_id: typeof objectId === "string" ? objectId : null, payload: event }, { onConflict: "ramp_event_id", ignoreDuplicates: true });
  if (error) return Response.json({ error: "Unable to save event." }, { status: 500 }); return Response.json({ received: true });
}
