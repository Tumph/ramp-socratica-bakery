import { randomUUID } from "node:crypto";
import { catalogById } from "./catalog";
import { getDatabase } from "./db";
import { createRampBill } from "./ramp";
import { syncRampOrder } from "./ramp-sync";

export type RequestedItem = { productId: string; quantity: number };

export async function createOrder(teamId: string, requestedItems: RequestedItem[]) {
  const lines = requestedItems
    .filter((item) => Number.isInteger(item.quantity) && item.quantity > 0 && item.quantity <= 20)
    .map((item) => {
      const product = catalogById.get(item.productId);
      if (!product) throw new Error(`Unknown product: ${item.productId}`);
      return { product, quantity: item.quantity };
    });

  if (lines.length === 0) throw new Error("Choose at least one product.");

  const totalCents = lines.reduce((total, line) => total + line.product.priceCents * line.quantity, 0);
  const orderId = randomUUID();
  const invoiceNumber = `SOC-${orderId.slice(0, 8).toUpperCase()}`;
  const database = getDatabase();

  const sandbox = (process.env.RAMP_MODE ?? "mock") !== "mock";
  const vendorId = process.env.RAMP_VENDOR_ID;
  if (sandbox && !vendorId) throw new Error("Configure the Ramp supplier before placing orders.");

  const reserve = database.transaction(() => {
    const team = database.prepare(
      `SELECT t.id, t.available_cash_cents, r.ramp_entity_id
       FROM teams t LEFT JOIN team_ramp_entities r ON r.team_id = t.id WHERE t.id = ?`
    ).get(teamId) as { id: string; available_cash_cents: number; ramp_entity_id: string | null } | undefined;

    if (!team) throw new Error("Team not found.");
    if ((process.env.RAMP_MODE ?? "mock") !== "mock" && !team.ramp_entity_id) {
      throw new Error("This team has not been connected to a Ramp bakery entity yet.");
    }
    if (team.available_cash_cents < totalCents) throw new Error("This order exceeds the team's available cash.");

    database.prepare(
      "INSERT INTO orders (id, team_id, invoice_number, status, total_cents) VALUES (?, ?, ?, 'BILL_CREATING', ?)"
    ).run(orderId, team.id, invoiceNumber, totalCents);

    const insertLine = database.prepare(
      "INSERT INTO order_lines (order_id, product_id, product_name, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?)"
    );
    for (const line of lines) {
      insertLine.run(orderId, line.product.id, line.product.name, line.quantity, line.product.priceCents);
    }

    database.prepare(
      "UPDATE teams SET available_cash_cents = available_cash_cents - ? WHERE id = ?"
    ).run(totalCents, team.id);

    if (sandbox) {
      database.prepare("INSERT INTO order_ramp_sync (order_id, entity_id, vendor_id) VALUES (?, ?, ?)")
        .run(orderId, team.ramp_entity_id, vendorId);
    }
    return team;
  });

  const reservedTeam = reserve();

  try {
    const rampBill = sandbox ? await syncRampOrder(orderId) : await createRampBill({
      entityId: reservedTeam.ramp_entity_id,
      invoiceNumber,
      totalCents,
      lines: lines.map((line) => ({
        name: line.product.name,
        quantity: line.quantity,
        unitPriceCents: line.product.priceCents,
      })),
    });

    if (!sandbox) database.prepare(
      "UPDATE orders SET status = 'AWAITING_RAMP_REVIEW', ramp_bill_id = ?, ramp_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(rampBill.id, rampBill.status, orderId);

    return { id: orderId, invoiceNumber, totalCents, rampBillId: rampBill.id, mode: rampBill.mode };
  } catch (error) {
    database.transaction(() => {
      database.prepare(
        "UPDATE orders SET status = 'INTEGRATION_ERROR', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
      ).run(error instanceof Error ? error.message : "Unknown Ramp error", orderId);
      if (!sandbox) database.prepare(
        "UPDATE teams SET available_cash_cents = available_cash_cents + ? WHERE id = ?"
      ).run(totalCents, reservedTeam.id);
    })();
    if (sandbox) return { id: orderId, invoiceNumber, totalCents, rampBillId: null, mode: "sandbox" as const, integrationPending: true };
    throw error;
  }
}

export function fulfillOrderByBillId(rampBillId: string) {
  const database = getDatabase();
  return database.transaction(() => {
    const order = database.prepare(
      "SELECT id, team_id, status FROM orders WHERE ramp_bill_id = ?"
    ).get(rampBillId) as { id: string; team_id: string; status: string } | undefined;

    if (!order) throw new Error("No event order is mapped to this Ramp bill.");
    if (order.status === "FULFILLED") return { orderId: order.id, alreadyFulfilled: true };

    const lines = database.prepare(
      "SELECT product_id, product_name, quantity FROM order_lines WHERE order_id = ?"
    ).all(order.id) as Array<{ product_id: string; product_name: string; quantity: number }>;

    const addInventory = database.prepare(`
      INSERT INTO inventory (team_id, product_id, product_name, quantity)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(team_id, product_id) DO UPDATE SET quantity = quantity + excluded.quantity
    `);
    for (const line of lines) {
      addInventory.run(order.team_id, line.product_id, line.product_name, line.quantity);
    }

    database.prepare(`
      UPDATE orders
      SET status = 'FULFILLED', ramp_status = 'PAYMENT_COMPLETED',
          paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP), fulfilled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(order.id);

    return { orderId: order.id, alreadyFulfilled: false };
  })();
}
