import { FacilitatorOrders, type FacilitatorOrder } from "@/components/FacilitatorOrders";
import { getDatabase } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function FacilitatorPage() {
  const orders = getDatabase().prepare(`
    SELECT o.id, o.invoice_number, o.status, o.total_cents, o.ramp_bill_id,
           o.ramp_status, o.error_message, o.created_at, t.name AS team_name
    FROM orders o JOIN teams t ON t.id = o.team_id
    ORDER BY o.created_at DESC
    LIMIT 100
  `).all() as FacilitatorOrder[];

  return (
    <main>
      <section className="pageHeading">
        <p className="eyebrow">Event control room</p>
        <h1>Facilitator console</h1>
        <p>Trace supplier orders into Ramp and watch fulfillment state.</p>
      </section>
      <FacilitatorOrders initialOrders={orders} />
    </main>
  );
}
