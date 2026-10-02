import assert from "node:assert/strict";
import test from "node:test";
import { defaultConfig } from "../src/lib/ramp/config";
import {
  storefrontVendors,
  purchaseTotalCents,
  incompleteExpenseFor,
  shortTimestamp,
  longTimestamp,
} from "../src/lib/ramp/storefront";

test("each vendor resolves to its own catalogue products", () => {
  const stalls = storefrontVendors(defaultConfig);
  assert.equal(stalls.length, 3);
  const names = stalls.map((s) => s.name);
  assert.deepEqual(names, ["Aisle", "Fruits", "Fridge"]);
  // No product is sold by two vendors.
  const all = stalls.flatMap((s) => s.products.map((p) => p.id));
  assert.equal(new Set(all).size, all.length);
});

test("purchase totals come from the catalogue, not the caller", () => {
  // Bread flour 4800, free-run eggs 1800.
  assert.equal(purchaseTotalCents([{ productId: "flour", quantity: 2 }]), 9600);
  assert.equal(
    purchaseTotalCents([{ productId: "flour", quantity: 1 }, { productId: "eggs", quantity: 3 }]),
    4800 + 5400,
  );
});

test("purchase totals reject unknown products and bad quantities", () => {
  assert.throws(() => purchaseTotalCents([{ productId: "nope", quantity: 1 }]));
  assert.throws(() => purchaseTotalCents([{ productId: "flour", quantity: 0 }]));
  assert.throws(() => purchaseTotalCents([{ productId: "flour", quantity: 1.5 }]));
});

test("a purchase becomes an incomplete expense carrying the vendor's memo", () => {
  const expense = incompleteExpenseFor(defaultConfig, {
    id: "p1",
    vendorId: "fridge",
    cardId: "socratica",
    lines: [{ productId: "butter", quantity: 1 }],
    at: new Date(2026, 8, 29, 20, 53),
  });
  assert.equal(expense.merchantName, "Fridge");
  assert.equal(expense.memo, "Chilled dairy and eggs");
  assert.equal(expense.amountCents, 7200);
  assert.equal(expense.receiptRequired, true);
  assert.match(expense.spentFrom, /\(8870\)$/);
});

test("timestamps match the two formats the screens use", () => {
  const at = new Date(2026, 8, 29, 20, 53);
  assert.equal(shortTimestamp(at), "Sep 29 at 8:53 p.m.");
  assert.equal(longTimestamp(at), "Sep 29, 2026 at 8:53 p.m.");
  assert.equal(shortTimestamp(new Date(2026, 8, 29, 0, 5)), "Sep 29 at 12:05 a.m.");
});
