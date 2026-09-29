"use client";

import { useEffect, useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";

type CreatedOrder = {
  id: string;
  invoiceNumber: string;
  totalCents: number;
  rampBillId: string | null;
  integrationPending?: boolean;
  mode: "sandbox";
};

const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function Storefront({ products }: { products: Product[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [fulfilled, setFulfilled] = useState(false);

  useEffect(() => {
    if (!order || fulfilled) return;
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/orders/${order.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json();
        if (active) {
          setFulfilled(result.order.status === "FULFILLED");
          setError(result.order.status === "INTEGRATION_ERROR" ? "Your order is saved. An Admin needs to resolve its invoice setup; please do not reorder." : "");
        }
      } catch { /* The next poll retries transient network failures. */ }
    };
    void refresh();
    const timer = setInterval(refresh, 5000);
    return () => { active = false; clearInterval(timer); };
  }, [order, fulfilled]);

  const total = useMemo(
    () => products.reduce((sum, product) => sum + product.priceCents * (quantities[product.id] ?? 0), 0),
    [products, quantities],
  );

  async function submitOrder() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: Object.entries(quantities)
            .filter(([, quantity]) => quantity > 0)
            .map(([productId, quantity]) => ({ productId, quantity })),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to place order.");
      setOrder(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to place order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (order) {
    return (
      <section className="confirmation panel">
        <p className="eyebrow">Order submitted</p>
        <h2>{fulfilled ? "Your supplies have arrived." : "Now finish the job in Ramp."}</h2>
        <p>
          Invoice <strong>{order.invoiceNumber}</strong> totals {money.format(order.totalCents / 100)}.
          {fulfilled
            ? " The paid bill was matched to this order and the bakery inventory was updated."
            : " Open Bill Pay in Ramp to review and submit the draft invoice, then complete approval and payment."}
        </p>
        <div className="steps">
          <span className="done">1. Order placed</span>
          <span className={fulfilled ? "done" : "active"}>2. Review and pay in Ramp</span>
          <span className={fulfilled ? "done" : "muted"}>3. Supplies delivered</span>
        </div>
        {error && <p className="error">{error}</p>}
        <a className="textLink" href={`/api/orders/${order.id}/invoice`}>Download invoice PDF</a>
        <a className="textLink" href={`/invoices/${order.id}`} target="_blank">View supplier invoice</a>
      </section>
    );
  }

  return (
    <>
      <div className="catalogue">
        {products.map((product) => {
          const quantity = quantities[product.id] ?? 0;
          return (
            <article className="product" key={product.id}>
              <span className="productEmoji" aria-hidden>{product.emoji}</span>
              <div>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <strong>{money.format(product.priceCents / 100)} / {product.unit}</strong>
              </div>
              <div className="quantity" aria-label={`${product.name} quantity`}>
                <button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantities({ ...quantities, [product.id]: Math.max(0, quantity - 1) })}>−</button>
                <output aria-live="polite">{quantity}</output>
                <button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => setQuantities({ ...quantities, [product.id]: Math.min(20, quantity + 1) })}>+</button>
              </div>
            </article>
          );
        })}
      </div>
      <aside className="checkout panel">
        <div>
          <p className="eyebrow">Wholesale account order</p>
          <h2>Purchase order</h2>
          <p>You will receive a supplier invoice. Nothing is paid at checkout.</p>
        </div>
        <div className="total"><span>Invoice total</span><strong>{money.format(total / 100)}</strong></div>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="button" disabled={total === 0 || submitting} onClick={submitOrder}>
          {submitting ? "Creating Ramp bill…" : "Place order on account"}
        </button>
      </aside>
    </>
  );
}
