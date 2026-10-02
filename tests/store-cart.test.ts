import assert from "node:assert/strict";
import test from "node:test";
import { applyCartChange, cartTotals, parseCart, serializeCart } from "../src/lib/store/cart";

test("adding accumulates and removing decrements", () => {
  let lines = applyCartChange([], { type: "add", productId: "flour" });
  lines = applyCartChange(lines, { type: "add", productId: "flour", quantity: 2 });
  assert.deepEqual(lines, [{ productId: "flour", quantity: 3 }]);
  lines = applyCartChange(lines, { type: "remove", productId: "flour" });
  assert.deepEqual(lines, [{ productId: "flour", quantity: 2 }]);
});

test("removing the last one drops the line entirely", () => {
  const lines = applyCartChange([{ productId: "flour", quantity: 1 }], { type: "remove", productId: "flour" });
  assert.deepEqual(lines, []);
});

test("unknown products are never added", () => {
  assert.deepEqual(applyCartChange([], { type: "add", productId: "ghost" }), []);
});

test("a stale cookie cannot resurrect a removed product", () => {
  const raw = JSON.stringify([{ p: "flour", q: 2 }, { p: "ghost", q: 9 }]);
  assert.deepEqual(parseCart(raw), [{ productId: "flour", quantity: 2 }]);
});

test("malformed cookies degrade to an empty cart", () => {
  assert.deepEqual(parseCart(undefined), []);
  assert.deepEqual(parseCart("not json"), []);
  assert.deepEqual(parseCart('{"not":"an array"}'), []);
  assert.deepEqual(parseCart('[{"p":"flour","q":0}]'), []);
  assert.deepEqual(parseCart('[{"p":"flour","q":"two"}]'), []);
});

test("totals are priced from the catalogue", () => {
  // flour 4800, boxes 3200
  const { count, totalCents } = cartTotals([
    { productId: "flour", quantity: 2 },
    { productId: "boxes", quantity: 1 },
  ]);
  assert.equal(count, 3);
  assert.equal(totalCents, 4800 * 2 + 3200);
});

test("the cookie round-trips", () => {
  const lines = [{ productId: "flour", quantity: 2 }, { productId: "butter", quantity: 1 }];
  assert.deepEqual(parseCart(serializeCart(lines)), lines);
});
