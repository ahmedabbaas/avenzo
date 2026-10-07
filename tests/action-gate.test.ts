import { test } from "node:test";
import assert from "node:assert/strict";
import { createActionGate } from "../features/social/lib/action-gate.ts";

test("duplicate writes are blocked while independent actions stay responsive", async () => {
  const gate = createActionGate();
  let release!: () => void;
  let calls = 0;
  const first = gate.run("like:one", async () => {
    calls++;
    await new Promise<void>(resolve => { release = resolve; });
  });
  await gate.run("like:one", async () => { calls++; });
  await gate.run("save:one", async () => { calls++; });
  await gate.run("like:two", async () => { calls++; });
  assert.equal(calls, 3);
  release();
  await first;
  await gate.run("like:one", async () => { calls++; });
  assert.equal(calls, 4);
});

test("failed writes release the gate so retry can succeed", async () => {
  const gate = createActionGate();
  await assert.rejects(gate.run("save:one", async () => { throw new Error("offline"); }), /offline/);
  let retried = false;
  await gate.run("save:one", async () => { retried = true; });
  assert.equal(retried, true);
});
