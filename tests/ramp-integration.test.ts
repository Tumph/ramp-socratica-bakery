import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import Database from "better-sqlite3";
import { PDFDocument } from "pdf-lib";
import { createOrder, fulfillOrderByBillId } from "../src/lib/orders";
import { createRampBill, type RampResource } from "../src/lib/ramp";
import { syncRampOrder, applyRampBill } from "../src/lib/ramp-sync";
import { generateInvoicePdf } from "../src/lib/invoice";
import { receiveRampWebhook, processRampWebhookInbox } from "../src/lib/ramp-webhooks";

const team = "11111111-1111-4111-8111-111111111111";
const globals = globalThis as typeof globalThis & { bakeryDatabase?: Database.Database };
function setup() {
  const original = { ...process.env };
  const fetch = globalThis.fetch;
  const db = new Database(":memory:");
  db.exec(readFileSync("sql/schema.sql", "utf8"));
  globals.bakeryDatabase = db;
  process.env.RAMP_MODE = "sandbox";
  process.env.RAMP_API_BASE_URL = "https://demo-api.ramp.com";
  process.env.RAMP_ACCESS_TOKEN = "test-token";
  process.env.RAMP_VENDOR_ID = "vendor";
  process.env.RAMP_ENTITY_ID = "wrong-global-entity";
  process.env.RAMP_WEBHOOK_SECRET = "test-secret";
  process.env.RAMP_BUSINESS_ID = "business";
  process.env.RAMP_WEBHOOK_SETUP_TOKEN = "setup-token";
  const drafts = new Map<string, RampResource>();
  let bills: RampResource[] = [];
  let creates = 0; let uploads = 0; let failUpload = false; let loseCreate = false;
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const path = url.pathname;
    assert.equal(url.origin, "https://demo-api.ramp.com");
    if (init.method === "POST" && path === "/developer/v1/bills/drafts") {
      const body = JSON.parse(String(init.body));
      creates++;
      const id = `draft-${creates}`;
      const draft = { id, entity_id: body.entity_id, invoice_number: body.invoice_number, vendor: { id: body.vendor_id },
        amount: { amount: body.line_items.reduce((sum: number, line: { amount: string }) => sum + Math.round(Number(line.amount) * 100), 0), currency_code: body.invoice_currency }, status: "DRAFT", invoice_urls: [] };
      drafts.set(id, draft);
      if (loseCreate) throw new Error("Response lost after Ramp created draft");
      return Response.json(draft);
    }
    if (path.endsWith("/attachments")) {
      uploads++;
      if (failUpload) return Response.json({}, { status: 503 });
      const form = init.body as FormData;
      assert.equal(form.get("attachment_type"), "INVOICE");
      const file = form.get("file") as File;
      assert.equal(file.type, "application/pdf");
      assert.ok((await PDFDocument.load(await file.arrayBuffer())).getPageCount() > 0);
      drafts.get(path.split("/").at(-2)!)!.invoice_urls = ["https://example.invalid/invoice.pdf"];
      return Response.json({ id: "attachment" });
    }
    if (path === "/developer/v1/bills/drafts") return Response.json({ data: [...drafts.values()].filter(d => d.invoice_number === url.searchParams.get("invoice_number")), page: { next: null } });
    if (path === "/developer/v1/bills") return Response.json({ data: bills.filter(b => b.invoice_number === url.searchParams.get("invoice_number")), page: { next: null } });
    const result = path.includes("/drafts/") ? drafts.get(path.split("/").at(-1)!) : bills.find(b => b.id === path.split("/").at(-1));
    return Response.json(result ?? {}, { status: result ? 200 : 404 });
  };
  return { db, drafts, setBills: (value: RampResource[]) => { bills = value; },
    setFailUpload: (value: boolean) => { failUpload = value; }, setLoseCreate: () => { loseCreate = true; },
    counts: () => ({ creates, uploads }),
    map: (id = team, entity = "entity-a") => db.prepare("INSERT INTO team_ramp_entities (team_id, ramp_entity_id) VALUES (?, ?)").run(id, entity),
    cleanup: () => { db.close(); delete globals.bakeryDatabase; globalThis.fetch = fetch; process.env = original; },
  };
}

const items = [{ productId: "eggs", quantity: 1 }];
function signedRequest(event: unknown, secret = "test-secret") {
  const body = JSON.stringify(event);
  return new Request("http://localhost/api/webhooks/ramp", { method: "POST", body,
    headers: { "x-ramp-signature": createHmac("sha256", secret).update(body).digest("hex") } });
}

test("team entity routing, CAD units, invoice PDF, and unmapped-team rejection", async () => {
  const s = setup();
  try {
    await assert.rejects(createOrder(team, items), /not been connected/);
    assert.equal((s.db.prepare("SELECT COUNT(*) n FROM orders").get() as { n: number }).n, 0);
    s.map();
    s.db.prepare("INSERT INTO teams (id,slug,name,starting_cash_cents,available_cash_cents) VALUES ('second','second','Second',100000,100000)").run();
    s.map("second", "entity-b");
    const first = await createOrder(team, items);
    await createOrder("second", items);
    assert.deepEqual([...s.drafts.values()].map(d => d.entity_id), ["entity-a", "entity-b"]);
    assert.equal(s.drafts.get("draft-1")!.amount.amount, 1800);
    assert.equal((await PDFDocument.load(await generateInvoicePdf(first.id))).getTitle(), `Invoice ${first.invoiceNumber}`);
    assert.deepEqual(s.counts(), { creates: 2, uploads: 2 });
    await syncRampOrder(first.id);
    assert.deepEqual(s.counts(), { creates: 2, uploads: 2 });
  } finally { s.cleanup(); }
});

test("attachment failure retains reservation and retries without a second draft", async () => {
  const s = setup();
  try {
    s.map(); s.setFailUpload(true);
    const order = await createOrder(team, items);
    assert.equal("integrationPending" in order && order.integrationPending, true);
    assert.equal((s.db.prepare("SELECT available_cash_cents cash FROM teams WHERE id = ?").get(team) as { cash: number }).cash, 98200);
    s.setFailUpload(false);
    await syncRampOrder(order.id);
    assert.equal(s.counts().creates, 1);
    assert.equal((s.db.prepare("SELECT status FROM orders WHERE id = ?").get(order.id) as { status: string }).status, "AWAITING_RAMP_REVIEW");
  } finally { s.cleanup(); }
});

test("lost creation response is recovered by exact invoice without duplicate creation", async () => {
  const s = setup();
  try {
    s.map(); s.setLoseCreate();
    const order = await createOrder(team, items);
    await syncRampOrder(order.id);
    assert.equal(s.counts().creates, 1);
  } finally { s.cleanup(); }
});

test("uncertain create without a matching draft refuses blind retry", async () => {
  const s = setup();
  try {
    s.map(); s.setLoseCreate();
    const order = await createOrder(team, items);
    s.drafts.clear();
    await assert.rejects(syncRampOrder(order.id), /refusing to create a possible duplicate/);
    assert.equal(s.counts().creates, 1);
  } finally { s.cleanup(); }
});

test("paid webhook resolves draft-to-bill; duplicate events and reconciliation fulfill once", async () => {
  const s = setup();
  try {
    s.map(); const order = await createOrder(team, items);
    const draft = s.drafts.get("draft-1")!;
    const bill = { ...draft, id: "bill-1", draft_bill_id: draft.id, status: "OPEN", status_summary: "APPROVAL_PENDING" };
    s.setBills([bill]);
    const event = { id: "event-1", type: "bills.paid", business_id: "business", object: { id: bill.id } };
    assert.equal((await receiveRampWebhook(signedRequest(event))).status, 200);
    await processRampWebhookInbox();
    assert.equal((s.db.prepare("SELECT COUNT(*) n FROM inventory").get() as { n: number }).n, 0, "A claimed paid event cannot override an unpaid bill");
    bill.status = "PAID"; bill.status_summary = "PAYMENT_COMPLETED";
    // Reconciliation repairs a missed actual paid event.
    await syncRampOrder(order.id);
    const duplicate = { ...event, id: "event-2" };
    await receiveRampWebhook(signedRequest(duplicate));
    await receiveRampWebhook(signedRequest(duplicate));
    await processRampWebhookInbox();
    await syncRampOrder(order.id);
    assert.equal((s.db.prepare("SELECT quantity FROM inventory WHERE team_id = ?").get(team) as { quantity: number }).quantity, 1);
    assert.equal((s.db.prepare("SELECT COUNT(*) n FROM webhook_events").get() as { n: number }).n, 2);
    assert.throws(() => applyRampBill(order.id, { ...bill, entity_id: "other-team" }), /does not match/);
    assert.throws(() => applyRampBill(order.id, { ...bill, amount: { amount: 1, currency_code: "CAD" } }), /does not match/);
  } finally { s.cleanup(); }
});

test("webhook authentication rejects invalid signatures, malformed JSON, and other businesses", async () => {
  const s = setup();
  try {
    const event = { id: "event", type: "bills.paid", business_id: "business", object: { id: "bill" } };
    assert.equal((await receiveRampWebhook(signedRequest(event, "wrong-secret"))).status, 401);
    assert.equal((await receiveRampWebhook(signedRequest(null))).status, 400);
    assert.equal((await receiveRampWebhook(signedRequest({ ...event, business_id: "other" }))).status, 403);
    assert.equal((await receiveRampWebhook(new Request("http://localhost", { method: "POST", body: JSON.stringify(event), headers: { "x-bakery-webhook-setup": "setup-token" } }))).status, 401);
    assert.equal((s.db.prepare("SELECT COUNT(*) n FROM webhook_events").get() as { n: number }).n, 0);
  } finally { s.cleanup(); }
});

test("mock mode still works without credentials or entity mappings", async () => {
  const s = setup();
  try {
    process.env.RAMP_MODE = "mock";
    delete process.env.RAMP_ACCESS_TOKEN;
    delete process.env.RAMP_VENDOR_ID;
    globalThis.fetch = async () => { throw new Error("Unexpected network call"); };
    const order = await createOrder(team, items);
    assert.equal(order.mode, "mock");
    fulfillOrderByBillId(order.rampBillId!);
    fulfillOrderByBillId(order.rampBillId!);
    assert.equal((s.db.prepare("SELECT quantity FROM inventory").get() as { quantity: number }).quantity, 1);
    const direct = await createRampBill({ entityId: null, invoiceNumber: "TEST", totalCents: 0, lines: [] });
    assert.equal(direct.mode, "mock");
  } finally { s.cleanup(); }
});
