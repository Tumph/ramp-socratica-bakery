import { createAdminClient } from "./supabase/admin";
import { getInvoice, generateInvoicePdf } from "./invoice";
import { attachRampInvoice, createRampBill, findRampResources, rampRequest, type RampResource } from "./ramp";
import { fulfillOrderByBillId } from "./orders";

type SyncOrder = { order_id: string; entity_id: string; vendor_id: string; draft_id: string | null; create_attempted_at: string | null; attachment_uploaded: boolean; ramp_bill_id: string | null; invoice_number: string; total_cents: number; status: string };
async function readSync(orderId: string): Promise<SyncOrder> {
  const admin = createAdminClient(); const { data: sync } = await admin.from("order_ramp_sync").select("order_id, entity_id, vendor_id, draft_id, create_attempted_at, attachment_uploaded").eq("order_id", orderId).maybeSingle();
  const { data: order } = await admin.from("orders").select("ramp_bill_id, invoice_number, total_cents, status").eq("id", orderId).maybeSingle();
  if (!sync || !order) throw new Error("Order has no Sandbox integration snapshot."); return { ...sync, ...order };
}
function validateResource(row: SyncOrder, bill: RampResource) { if (!bill.id || bill.entity_id !== row.entity_id || bill.vendor?.id !== row.vendor_id || bill.invoice_number !== row.invoice_number || bill.amount?.currency_code !== "CAD" || bill.amount?.amount !== row.total_cents) throw new Error("Ramp bill does not match the order's entity, supplier, invoice, currency, or amount. Manual review required."); if (row.ramp_bill_id && row.ramp_bill_id !== bill.id) throw new Error("Order already maps to a different Ramp bill."); }
function statusFor(bill: RampResource) { return bill.status_summary === "APPROVAL_REJECTED" || bill.status_summary === "ARCHIVED" ? "REJECTED" : bill.status_summary === "APPROVAL_PENDING" ? "AWAITING_RAMP_REVIEW" : bill.status_summary?.startsWith("PAYMENT_") || bill.status_summary === "AWAITING_RELEASE" ? "PAYMENT_PENDING" : "AWAITING_RAMP_REVIEW"; }
export async function applyRampBill(orderId: string, bill: RampResource) {
  const row = await readSync(orderId); validateResource(row, bill); if (row.draft_id && bill.draft_bill_id !== row.draft_id) throw new Error("Ramp bill does not originate from this order's draft."); const admin = createAdminClient();
  await admin.from("orders").update({ ramp_bill_id: bill.id, ramp_status: bill.status_summary ?? bill.status }).eq("id", orderId);
  if (bill.status === "PAID" && bill.status_summary === "PAYMENT_COMPLETED") return fulfillOrderByBillId(bill.id);
  if (row.status !== "FULFILLED") await admin.from("orders").update({ status: statusFor(bill), error_message: null }).eq("id", orderId);
  return { orderId, paid: false, rampStatus: bill.status_summary ?? bill.status };
}
export async function reconcileRampBill(billId: string) {
  const bill = await rampRequest<RampResource>(`/developer/v1/bills/${encodeURIComponent(billId)}`); const admin = createAdminClient();
  let { data: row } = await admin.from("orders").select("id").eq("ramp_bill_id", billId).maybeSingle();
  if (!row && bill.draft_bill_id) { const found = await admin.from("order_ramp_sync").select("order_id").eq("draft_id", bill.draft_bill_id).maybeSingle(); row = found.data ? { id: found.data.order_id } : null; }
  if (!row) { const found = await admin.from("orders").select("id, order_ramp_sync!inner(entity_id, vendor_id)").eq("invoice_number", bill.invoice_number).eq("order_ramp_sync.entity_id", bill.entity_id).eq("order_ramp_sync.vendor_id", bill.vendor?.id ?? "").maybeSingle(); row = found.data; }
  if (!row) return { ignored: true, reason: "Bill is not an event order." }; const result = await applyRampBill(row.id, bill); if (bill.draft_bill_id) await admin.from("order_ramp_sync").update({ draft_id: bill.draft_bill_id }).eq("order_id", row.id).is("draft_id", null); return result;
}
export async function syncRampOrder(orderId: string) {
  const admin = createAdminClient(); let row = await readSync(orderId);
  try {
    if (row.ramp_bill_id) { const bill = await rampRequest<RampResource>(`/developer/v1/bills/${encodeURIComponent(row.ramp_bill_id)}`); await applyRampBill(orderId, bill); return { id: bill.id, status: bill.status_summary ?? bill.status, mode: "sandbox" as const }; }
    const filters = { invoice_number: row.invoice_number, entity_id: row.entity_id, vendor_id: row.vendor_id }; const submitted = await findRampResources("bills", filters); if (submitted.length > 1) throw new Error("Multiple Ramp bills match this order."); if (submitted[0]) { await applyRampBill(orderId, submitted[0]); return { id: submitted[0].id, status: submitted[0].status_summary ?? submitted[0].status, mode: "sandbox" as const }; }
    let draft: RampResource | undefined; if (row.draft_id) draft = await rampRequest<RampResource>(`/developer/v1/bills/drafts/${encodeURIComponent(row.draft_id)}`); else { const drafts = await findRampResources("bills/drafts", filters); if (drafts.length > 1) throw new Error("Multiple Ramp drafts match this order."); draft = drafts[0]; if (!draft) { if (row.create_attempted_at) throw new Error("Previous draft creation outcome is uncertain. Reconcile before retrying."); await admin.from("order_ramp_sync").update({ create_attempted_at: new Date().toISOString() }).eq("order_id", orderId).is("create_attempted_at", null); row = await readSync(orderId); if (!row.create_attempted_at) throw new Error("Another synchronization started."); const invoice = await getInvoice(orderId); const created = await createRampBill({ entityId: row.entity_id, vendorId: row.vendor_id, invoiceNumber: row.invoice_number, totalCents: row.total_cents, issuedAt: invoice.created_at.slice(0, 10), lines: invoice.lines.map((line) => ({ name: line.product_name, quantity: line.quantity, unitPriceCents: line.unit_price_cents })) }); await admin.from("order_ramp_sync").update({ draft_id: created.id }).eq("order_id", orderId); draft = await rampRequest<RampResource>(`/developer/v1/bills/drafts/${encodeURIComponent(created.id)}`); } }
    validateResource(row, draft); await admin.from("order_ramp_sync").update({ draft_id: draft.id }).eq("order_id", orderId); if (!draft.invoice_urls?.length) { await attachRampInvoice(draft.id, row.invoice_number, await generateInvoicePdf(orderId)); }
    await admin.from("order_ramp_sync").update({ attachment_uploaded: true }).eq("order_id", orderId); await admin.from("orders").update({ status: "AWAITING_RAMP_REVIEW", ramp_status: "DRAFT", error_message: null }).eq("id", orderId); return { id: draft.id, status: "DRAFT", mode: "sandbox" as const };
  } catch (error) { await admin.from("orders").update({ status: "INTEGRATION_ERROR", error_message: error instanceof Error ? error.message : "Ramp synchronization failed." }).eq("id", orderId); throw error; }
}
