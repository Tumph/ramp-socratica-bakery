import assert from "node:assert/strict";
import test from "node:test";
import { normalizePurchaseLines } from "../src/lib/orders";

test("purchase lines use the server catalogue price", () => {
  assert.deepEqual(normalizePurchaseLines([{ productId: "flour", quantity: 2 }]), [{ productId: "flour", productName: "Bread flour", quantity: 2, unitPriceCents: 4800 }]);
});

test("purchase lines reject invalid quantities and unknown products", () => {
  assert.throws(() => normalizePurchaseLines([{ productId: "flour", quantity: 0 }]));
  assert.throws(() => normalizePurchaseLines([{ productId: "not-a-product", quantity: 1 }]));
});
