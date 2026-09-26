import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getDatabase } from "./db";

export function getInvoice(orderId: string) {
  const db = getDatabase();
  const order = db.prepare(`SELECT o.id, o.invoice_number, o.total_cents, o.created_at, o.team_id, t.name AS team_name
    FROM orders o JOIN teams t ON t.id = o.team_id WHERE o.id = ?`).get(orderId) as
    { id: string; invoice_number: string; total_cents: number; created_at: string; team_id: string; team_name: string } | undefined;
  if (!order) throw new Error("Order not found.");
  const lines = db.prepare("SELECT product_name, quantity, unit_price_cents FROM order_lines WHERE order_id = ? ORDER BY id").all(orderId) as
    Array<{ product_name: string; quantity: number; unit_price_cents: number }>;
  return { ...order, lines };
}

export async function generateInvoicePdf(orderId: string) {
  const invoice = getInvoice(orderId);
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([612, 792]);
  let y = 740;
  // Standard PDF fonts cannot encode arbitrary Unicode; retain a readable printable fallback.
  const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, "?");
  const text = (value: string, size = 11, strong = false) => {
    if (y < 60) { page = pdf.addPage([612, 792]); y = 740; }
    page.drawText(safe(value), { x: 48, y, size, font: strong ? bold : regular, color: rgb(0.15, 0.15, 0.15) });
    y -= size + 12;
  };
  const money = (cents: number) => `CAD ${(cents / 100).toFixed(2)}`;
  text("Socratica Bakery Supply", 22, true);
  text(`Invoice ${invoice.invoice_number}`, 16, true);
  // Wrap long bakery names to keep invoice content on the page.
  for (const part of (`Bill to: ${invoice.team_name}`).match(/.{1,75}/g) ?? []) text(part);
  text(`Issued: ${invoice.created_at.slice(0, 10)}    Terms: Net 7`);
  const due = new Date(`${invoice.created_at.slice(0, 10)}T00:00:00Z`);
  due.setUTCDate(due.getUTCDate() + 7);
  text(`Due: ${due.toISOString().slice(0, 10)}`);
  y -= 12;
  for (const line of invoice.lines) {
    text(`${line.product_name} - ${line.quantity} x ${money(line.unit_price_cents)} = ${money(line.quantity * line.unit_price_cents)}`);
  }
  y -= 12;
  text(`Total due: ${money(invoice.total_cents)}`, 16, true);
  text("Fictional workshop invoice. No real goods or money are involved.", 10);
  pdf.setTitle(`Invoice ${invoice.invoice_number}`);
  pdf.setAuthor("Socratica Bakery Supply");
  return pdf.save();
}
