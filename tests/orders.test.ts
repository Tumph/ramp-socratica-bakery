import assert from "node:assert/strict";
import test from "node:test";
import { normalizePurchaseLines } from "../src/lib/orders";

test("purchase lines require a registered server-side store", () => {
  assert.throws(() => normalizePurchaseLines([{ productId: "flour", quantity: 1 }], "unknown-store"));
});
