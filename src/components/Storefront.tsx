"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/catalog";

type CreatedOrder = { id: string; invoiceNumber: string; totalCents: number; transactionId: string; availableCents: number; mode: "simulator" };
const money = new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" });

export function Storefront({ products }: { products: Product[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [requestId] = useState(() => crypto.randomUUID());
  const total = useMemo(() => products.reduce((sum, product) => sum + product.priceCents * (quantities[product.id] ?? 0), 0), [products, quantities]);

  async function submitOrder() {
    setSubmitting(true); setError("");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": requestId }, body: JSON.stringify({ items: Object.entries(quantities).filter(([, quantity]) => quantity > 0).map(([productId, quantity]) => ({ productId, quantity })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to place order.");
      setOrder(result);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to place order."); }
    finally { setSubmitting(false); }
  }

  if (order) return <section className="confirmation panel"><p className="eyebrow">Purchase posted</p><h2>Your supplies have arrived.</h2><p>Transaction <strong>{order.transactionId.slice(0, 8).toUpperCase()}</strong> charged {money.format(order.totalCents / 100)} to your team’s shared workshop fund. {money.format(order.availableCents / 100)} remains.</p><div className="steps"><span className="done">1. Card checked</span><span className="done">2. Transaction posted</span><span className="done">3. Supplies delivered</span></div><a className="textLink" href={`/invoices/${order.id}`} target="_blank">View supplier receipt</a></section>;

  return <><div className="catalogue">{products.map((product) => { const quantity = quantities[product.id] ?? 0; return <article className="product" key={product.id}><span className="productEmoji" aria-hidden>{product.emoji}</span><div><h3>{product.name}</h3><p>{product.description}</p><strong>{money.format(product.priceCents / 100)} / {product.unit}</strong></div><div className="quantity" aria-label={`${product.name} quantity`}><button type="button" aria-label={`Decrease ${product.name} quantity`} onClick={() => setQuantities({ ...quantities, [product.id]: Math.max(0, quantity - 1) })}>−</button><output aria-live="polite">{quantity}</output><button type="button" aria-label={`Increase ${product.name} quantity`} onClick={() => setQuantities({ ...quantities, [product.id]: Math.min(20, quantity + 1) })}>+</button></div></article>; })}</div><aside className="checkout panel"><div><p className="eyebrow">Workshop card purchase</p><h2>Purchase order</h2><p>Your active mock card draws from the team’s shared workshop fund.</p></div><div className="total"><span>Purchase total</span><strong>{money.format(total / 100)}</strong></div>{error && <p className="error" role="alert">{error}</p>}<button className="primary" type="button" disabled={total === 0 || submitting} onClick={submitOrder}>{submitting ? "Posting transaction…" : "Pay with workshop card"}</button></aside></>;
}
