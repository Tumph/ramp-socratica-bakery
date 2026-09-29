"use client";

import { useState } from "react";

export type FacilitatorOrder = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  team_name: string;
  error_message: string | null;
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function FacilitatorOrders({ initialOrders }: { initialOrders: FacilitatorOrder[] }) {
  const [orders, setOrders] = useState<FacilitatorOrder[]>(initialOrders);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      const response = await fetch("/api/facilitator/orders", { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to load orders.");
      setOrders(result.orders);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load orders.");
    }
  }

  return (
    <section className="panel tablePanel" aria-labelledby="recent-orders-heading">
      <header className="tableHeader">
        <div><p className="eyebrow">Live operations</p><h2 id="recent-orders-heading">Recent orders</h2><p className="mutedCopy">The latest supplier orders and their local transaction state.</p></div>
        <button className="secondary" type="button" onClick={refresh}>Refresh</button>
      </header>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="tableScroll"><table className="ordersTable">
        <thead><tr><th scope="col">Invoice</th><th scope="col">Team</th><th scope="col">Status</th><th scope="col">Amount</th><th scope="col">Order status</th></tr></thead>
        <tbody>{orders.length === 0 ? <tr><td className="tableMessage" colSpan={5}>No orders yet.</td></tr> : orders.map((order) => (
          <tr key={order.id}>
            <th scope="row">{order.invoice_number}</th><td>{order.team_name}</td><td><span className={`status status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span>{order.error_message && <small className="tableError">{order.error_message}</small>}</td><td>{money.format(order.total_cents / 100)}</td><td>{order.status.replaceAll("_", " ")}</td>
          </tr>
        ))}</tbody>
      </table></div>
    </section>
  );
}
