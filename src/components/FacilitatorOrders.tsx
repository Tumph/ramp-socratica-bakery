"use client";

import { useState } from "react";

export type FacilitatorOrder = {
  id: string;
  invoice_number: string;
  status: string;
  total_cents: number;
  team_name: string;
  ramp_bill_id: string | null;
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
    <section className="panel tablePanel">
      <div className="tableHeader">
        <div><p className="eyebrow">Live operations</p><h2>Recent orders</h2></div>
        <button className="secondary" onClick={refresh}>Refresh</button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="orderTable">
        {orders.length === 0 ? <p>No orders yet.</p> : orders.map((order) => (
          <article key={order.id} className="orderRow">
            <div><strong>{order.invoice_number}</strong><small>{order.team_name}</small></div>
            <div><span className={`status status-${order.status.toLowerCase()}`}>{order.status.replaceAll("_", " ")}</span></div>
            <div><strong>{money.format(order.total_cents / 100)}</strong><small>{order.ramp_bill_id ?? "No bill ID"}</small></div>
            {order.error_message && <p className="error">{order.error_message}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}
