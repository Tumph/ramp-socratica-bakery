import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createAdminClient } from "./supabase/admin";

export async function getInvoice(orderId: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders").select("id, invoice_number, total_cents, created_at, team_id, teams!inner(name), vendors!inner(display_name)").eq("id", orderId).single();
  if (error || !order) throw new Error("Order not found.");
  const { data: lines } = await admin.from("order_lines").select("product_name, quantity, unit_price_cents").eq("order_id", orderId).order("id");
  return { ...order, team_name: (order.teams as unknown as { name: string }).name, vendor_name: (order.vendors as unknown as { display_name: string }).display_name, lines: lines ?? [] };
}

export async function generateInvoicePdf(orderId: string) {
  const invoice = await getInvoice(orderId); const pdf = await PDFDocument.create(); const regular = await pdf.embedFont(StandardFonts.Helvetica); const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]); let y = 740; const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, "?");
  const text = (value: string, size = 11, strong = false) => { if (y < 60) { page = pdf.addPage([612, 792]); y = 740; } page.drawText(safe(value), { x: 48, y, size, font: strong ? bold : regular, color: rgb(.15, .15, .15) }); y -= size + 12; };
  const money = (cents: number) => `CAD ${(cents / 100).toFixed(2)}`;
  text(invoice.vendor_name, 22, true); text(`Invoice ${invoice.invoice_number}`, 16, true); text(`Bill to: ${invoice.team_name}`); text(`Issued: ${invoice.created_at.slice(0, 10)}    Terms: Net 7`); y -= 12;
  for (const line of invoice.lines) text(`${line.product_name} - ${line.quantity} x ${money(line.unit_price_cents)} = ${money(line.quantity * line.unit_price_cents)}`);
  y -= 12; text(`Total due: ${money(invoice.total_cents)}`, 16, true); text("Fictional workshop invoice. No real goods or money are involved.", 10); pdf.setTitle(`Invoice ${invoice.invoice_number}`); return pdf.save();
}
