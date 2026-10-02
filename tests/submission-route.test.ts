import assert from "node:assert/strict";
import test from "node:test";
import { config } from "../src/proxy";

test("the public submission page bypasses auth proxy while the portal stays covered", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const asset of ["index.html", "styles.css", "script.js", "config.js", "Gocake.otf"]) {
    assert.equal(matcher.test(`/submission/${asset}`), false);
  }
  assert.equal(matcher.test("/ramp"), true);
});
