import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();
  const admin = createAdminClient();
  const { data: row } = await admin.from("orders").select("invoice_number, total_cents, created_at, teams!inner(name)").eq("id", id).eq("team_id", user.teamId).maybeSingle();
  const order = row ? { ...row, team_name: (row.teams as unknown as { name: string }).name } : null;
  if (!order) notFound();
  const { data: lineRows } = await admin.from("order_lines").select("product_name, quantity, unit_price_cents").eq("order_id", id).order("id");
  const lines = lineRows ?? [];

  return (
    <main className="invoicePage">
      <section className="invoiceSheet">
        <div className="invoiceTitle"><div><p className="eyebrow">Socratica Bakery Supply</p><h1>Invoice</h1></div><strong>{order.invoice_number}</strong></div>
        <div className="invoiceMeta"><div><small>Bill to</small><strong>{order.team_name}</strong></div><div><small>Issued</small><strong>{order.created_at.slice(0, 10)}</strong></div><div><small>Terms</small><strong>Net 7</strong></div></div>
        <table><thead><tr><th>Description</th><th>Qty.</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>
          {lines.map((line) => <tr key={line.product_name}><td>{line.product_name}</td><td>{line.quantity}</td><td>{money.format(line.unit_price_cents / 100)}</td><td>{money.format(line.unit_price_cents * line.quantity / 100)}</td></tr>)}
        </tbody></table>
        <div className="invoiceTotal"><span>Amount due</span><strong>{money.format(order.total_cents / 100)}</strong></div>
        <p className="invoiceNote">This is a fictional invoice for the Socratica bakery workshop. No real goods or money are involved.</p>
      </section>
    </main>
  );
}
