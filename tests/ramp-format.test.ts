import assert from "node:assert/strict";
import test from "node:test";
import { formatCardAmount, remainingFraction, greetingFor } from "../src/lib/ramp/format";

test("card amounts abbreviate above a thousand and keep cents below it", () => {
  assert.equal(formatCardAmount(40_000_000, "USD"), "$400K");
  assert.equal(formatCardAmount(130_000, "CAD"), "1.3K CAD");
  assert.equal(formatCardAmount(25_899, "CAD"), "258.99 CAD");
  assert.equal(formatCardAmount(0, "CAD"), "0.00 CAD");
});

test("the progress bar fills with what is left, not what was spent", () => {
  // The design draws 1.3K of a 3.7K limit as a 35.11% bar.
  assert.equal(Math.round(remainingFraction(130_000, 370_000)! * 10000) / 100, 35.14);
  assert.equal(remainingFraction(150_000, 150_000), 1);
  assert.equal(remainingFraction(0, 150_000), 0);
});

test("a card with no limit has no progress bar", () => {
  assert.equal(remainingFraction(40_000_000, undefined), null);
  assert.equal(remainingFraction(1000, 0), null);
});

test("an overdrawn fund clamps instead of rendering a negative bar", () => {
  // An Admin can lower a limit below prior spending, making the balance negative.
  assert.equal(remainingFraction(-5_000, 150_000), 0);
});

test("the greeting follows the time of day", () => {
  assert.equal(greetingFor(new Date(2026, 0, 1, 9)), "Good morning");
  assert.equal(greetingFor(new Date(2026, 0, 1, 14)), "Good afternoon");
  assert.equal(greetingFor(new Date(2026, 0, 1, 20)), "Good evening");
});
