import { notFound } from "next/navigation";
import { getDatabase } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const database = getDatabase();
  const order = database.prepare(`
    SELECT o.invoice_number, o.total_cents, o.created_at, t.name AS team_name
    FROM orders o JOIN teams t ON t.id = o.team_id WHERE o.id = ? AND o.team_id = ?
  `).get(id, user.teamId) as { invoice_number: string; total_cents: number; created_at: string; team_name: string } | undefined;
  if (!order) notFound();
  const lines = database.prepare(
    "SELECT product_name, quantity, unit_price_cents FROM order_lines WHERE order_id = ? ORDER BY id"
  ).all(id) as Array<{ product_name: string; quantity: number; unit_price_cents: number }>;

  return (
    <main className="invoicePage">
      <section className="invoiceSheet">
        <div className="invoiceTitle"><div><p className="eyebrow">Socratica Bakery Supply</p><h1>Invoice</h1></div><strong>{order.invoice_number}</strong></div>
        <div className="invoiceMeta"><div><small>Bill to</small><strong>{order.team_name}</strong></div><div><small>Issued</small><strong>{order.created_at.slice(0, 10)}</strong></div><div><small>Terms</small><strong>Net 7</strong></div></div>
        <table><thead><tr><th>Description</th><th>Qty.</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
          {lines.map((line) => <tr key={line.product_name}><td>{line.product_name}</td><td>{line.quantity}</td><td>{money.format(line.unit_price_cents / 100)}</td><td>{money.format(line.unit_price_cents * line.quantity / 100)}</td></tr>)}
        </tbody></table>
        <div className="invoiceTotal"><span>Amount due</span><strong>{money.format(order.total_cents / 100)}</strong></div>
        <p className="invoiceNote">This is a fictional invoice for the Ramp Socratica bakery workshop. No real goods or money are involved.</p>
      </section>
    </main>
  );
}
