import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { validRampSignature } from "../src/lib/ramp-webhooks";

test("Ramp signatures are verified against the exact request bytes", () => {
  const body = new TextEncoder().encode('{"id":"event"}');
  const signature = createHmac("sha256", "secret").update(body).digest("hex");
  assert.equal(validRampSignature(body, signature, "secret"), true);
  assert.equal(validRampSignature(body, signature, "other"), false);
});
