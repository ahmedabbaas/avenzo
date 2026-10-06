import { test } from "node:test";
import assert from "node:assert/strict";
import { validateContentFile, validateCoverFile, validateVerticalReelDimensions } from "../features/social/lib/upload-validation.ts";
globalThis.Deno = { test };
await import("../tests/auth-validation.test.ts");
await import("../tests/upload-validation.test.ts");
await import("../tests/collections.test.ts");
test("empty and corrupt uploads cannot reach publishing", () => {
  for (const size of [0, -1, NaN, Infinity]) {
    assert.ok(validateContentFile({type:"image/jpeg",size}, "post"));
    assert.ok(validateCoverFile({type:"image/jpeg",size}));
  }
  assert.equal(validateContentFile({type:"image/jpeg",size:25*1024*1024}, "post"), null);
});
test("reel dimensions must be finite positive portrait values", () => {
  for (const dimensions of [{width:0,height:1080},{width:720,height:NaN},{width:-1,height:1080},{width:720,height:Infinity}]) assert.ok(validateVerticalReelDimensions(dimensions));
  assert.equal(validateVerticalReelDimensions({width:720,height:1280}), null);
});
