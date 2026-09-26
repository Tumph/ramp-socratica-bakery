import { getDatabase } from "./db";
import { getInvoice, generateInvoicePdf } from "./invoice";
import { attachRampInvoice, createRampBill, findRampResources, rampRequest, type RampResource } from "./ramp";
import { fulfillOrderByBillId } from "./orders";

type SyncOrder = {
  order_id: string; entity_id: string; vendor_id: string; draft_id: string | null;
  create_attempted_at: string | null; attachment_uploaded: number;
  ramp_bill_id: string | null; invoice_number: string; total_cents: number; status: string;
};

function readSync(orderId: string) {
  const row = getDatabase().prepare(`SELECT s.*, o.ramp_bill_id, o.invoice_number, o.total_cents, o.status
    FROM order_ramp_sync s JOIN orders o ON o.id = s.order_id WHERE s.order_id = ?`).get(orderId) as SyncOrder | undefined;
  if (!row) throw new Error("Order has no Sandbox integration snapshot.");
  return row;
}

function validateResource(row: SyncOrder, bill: RampResource) {
  if (!bill.id || bill.entity_id !== row.entity_id || bill.vendor?.id !== row.vendor_id ||
      bill.invoice_number !== row.invoice_number || bill.amount?.currency_code !== "CAD" ||
      bill.amount?.amount !== row.total_cents) {
    throw new Error("Ramp bill does not match the order's entity, supplier, invoice, currency, or amount. Manual review required.");
  }
  if (row.ramp_bill_id && row.ramp_bill_id !== bill.id) throw new Error("Order already maps to a different Ramp bill.");
}

export function applyRampBill(orderId: string, bill: RampResource) {
  const db = getDatabase();
  return db.transaction(() => {
    const row = readSync(orderId);
    validateResource(row, bill);
    if (row.draft_id && bill.draft_bill_id !== row.draft_id) throw new Error("Ramp bill does not originate from this order's draft.");
    db.prepare("UPDATE orders SET ramp_bill_id = ?, ramp_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .run(bill.id, bill.status_summary ?? bill.status, orderId);
    if (bill.status === "PAID" && bill.status_summary === "PAYMENT_COMPLETED") {
      // Only the authoritative paid bill, never an approval or a claimed webhook status, delivers inventory.
      return fulfillOrderByBillId(bill.id);
    }
    if (row.status !== "FULFILLED") {
      const status = bill.status_summary === "APPROVAL_REJECTED" || bill.status_summary === "ARCHIVED"
        ? "REJECTED" : bill.status_summary === "APPROVAL_PENDING" ? "AWAITING_RAMP_REVIEW"
        : bill.status_summary?.startsWith("PAYMENT_") || bill.status_summary === "AWAITING_RELEASE" ? "PAYMENT_PENDING"
        : "AWAITING_RAMP_REVIEW";
      db.prepare("UPDATE orders SET status = ?, error_message = NULL WHERE id = ?").run(status, orderId);
    }
    return { orderId, paid: false, rampStatus: bill.status_summary ?? bill.status };
  })();
}

export async function reconcileRampBill(billId: string) {
  const bill = await rampRequest<RampResource>(`/developer/v1/bills/${encodeURIComponent(billId)}`);
  const db = getDatabase();
  let row = db.prepare("SELECT id FROM orders WHERE ramp_bill_id = ?").get(billId) as { id: string } | undefined;
  if (!row && bill.draft_bill_id) {
    const sync = db.prepare("SELECT order_id AS id FROM order_ramp_sync WHERE draft_id = ?").get(bill.draft_bill_id) as { id: string } | undefined;
    row = sync;
  }
  // Recover a create response lost before its draft ID was persisted using the unique invoice plus strict validation.
  if (!row) row = db.prepare(`SELECT o.id FROM orders o JOIN order_ramp_sync s ON s.order_id = o.id
    WHERE o.invoice_number = ? AND s.entity_id = ? AND s.vendor_id = ?`).get(bill.invoice_number, bill.entity_id, bill.vendor?.id ?? "") as { id: string } | undefined;
  if (!row) return { ignored: true, reason: "Bill is not an event order." };
  const result = applyRampBill(row.id, bill);
  if (bill.draft_bill_id) db.prepare("UPDATE order_ramp_sync SET draft_id = COALESCE(draft_id, ?) WHERE order_id = ?").run(bill.draft_bill_id, row.id);
  return result;
}

export async function syncRampOrder(orderId: string) {
  const db = getDatabase();
  const now = Date.now();
  const lease = now + 180_000;
  const claim = db.prepare("UPDATE order_ramp_sync SET lease_until = ? WHERE order_id = ? AND lease_until < ?").run(lease, orderId, now);
  if (!claim.changes) throw new Error("Order is already being synchronized. Try again later.");
  try {
    const row = readSync(orderId);
    if (row.ramp_bill_id) {
      const bill = await rampRequest<RampResource>(`/developer/v1/bills/${encodeURIComponent(row.ramp_bill_id)}`);
      applyRampBill(orderId, bill);
      return { id: bill.id, status: bill.status_summary ?? bill.status, mode: "sandbox" as const };
    }
    const filters = { invoice_number: row.invoice_number, entity_id: row.entity_id, vendor_id: row.vendor_id };
    const submitted = await findRampResources("bills", filters);
    if (submitted.length > 1) throw new Error("Multiple Ramp bills match this order. Manual review required.");
    if (submitted[0]) {
      applyRampBill(orderId, submitted[0]);
      return { id: submitted[0].id, status: submitted[0].status_summary ?? submitted[0].status, mode: "sandbox" as const };
    }
    let draft: RampResource | undefined;
    if (row.draft_id) draft = await rampRequest<RampResource>(`/developer/v1/bills/drafts/${encodeURIComponent(row.draft_id)}`);
    else {
      const existing = await findRampResources("bills/drafts", filters);
      if (existing.length > 1) throw new Error("Multiple Ramp drafts match this order. Manual review required.");
      draft = existing[0];
      if (!draft) {
        if (row.create_attempted_at) throw new Error("Previous draft creation outcome is uncertain. No matching draft found; refusing to create a possible duplicate. Inspect Ramp before creating a new order.");
        const invoice = getInvoice(orderId);
        // Persist intent before the network write. Ambiguous timeouts never trigger a blind create retry.
        const attempt = db.prepare("UPDATE order_ramp_sync SET create_attempted_at = CURRENT_TIMESTAMP WHERE order_id = ? AND create_attempted_at IS NULL").run(orderId);
        if (!attempt.changes) throw new Error("Another attempt already started draft creation. Reconcile instead of creating again.");
        const created = await createRampBill({
          entityId: row.entity_id, vendorId: row.vendor_id, invoiceNumber: row.invoice_number,
          totalCents: row.total_cents, issuedAt: invoice.created_at.slice(0, 10),
          lines: invoice.lines.map(line => ({ name: line.product_name, quantity: line.quantity, unitPriceCents: line.unit_price_cents })),
        });
        if (created.mode !== "sandbox") throw new Error("Sandbox order cannot be synchronized in mock mode.");
        db.prepare("UPDATE order_ramp_sync SET draft_id = ? WHERE order_id = ?").run(created.id, orderId);
        draft = await rampRequest<RampResource>(`/developer/v1/bills/drafts/${encodeURIComponent(created.id)}`);
      }
    }
    validateResource(row, draft);
    db.prepare("UPDATE order_ramp_sync SET draft_id = ? WHERE order_id = ?").run(draft.id, orderId);
    if (!draft.invoice_urls?.length) {
      await attachRampInvoice(draft.id, row.invoice_number, await generateInvoicePdf(orderId));
      const check = await rampRequest<RampResource>(`/developer/v1/bills/drafts/${encodeURIComponent(draft.id)}`);
      if (!check.invoice_urls?.length) throw new Error("Invoice attachment not visible yet; synchronize again to verify.");
    }
    db.prepare("UPDATE order_ramp_sync SET attachment_uploaded = 1 WHERE order_id = ?").run(orderId);
    db.prepare("UPDATE orders SET status = 'AWAITING_RAMP_REVIEW', ramp_status = 'DRAFT', error_message = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'FULFILLED'").run(orderId);
    return { id: draft.id, status: "DRAFT", mode: "sandbox" as const };
  } catch (error) {
    db.prepare("UPDATE orders SET status = 'INTEGRATION_ERROR', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'FULFILLED'")
      .run(error instanceof Error ? error.message : "Ramp synchronization failed.", orderId);
    throw error;
  } finally {
    db.prepare("UPDATE order_ramp_sync SET lease_until = 0 WHERE order_id = ? AND lease_until = ?").run(orderId, lease);
  }
}
