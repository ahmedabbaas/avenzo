import { createCallTaskQueue } from "../features/messages/lib/call-task-queue.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("concurrent realtime and polling signals serialize SDP work", async () => {
  const queue = createCallTaskQueue();
  const events: string[] = [];
  let release: () => void = () => {};
  const barrier = new Promise<void>((resolve) => { release = resolve; });
  const offer = queue.run(async () => {
    events.push("offer-start");
    await barrier;
    events.push("offer-end");
  });
  const ice = queue.run(async () => { events.push("ice"); });
  await Promise.resolve();
  assert(events.join(",") === "offer-start", "ICE must wait for SDP");
  release();
  await Promise.all([offer, ice]);
  assert(events.join(",") === "offer-start,offer-end,ice", "keep signal order");
});

Deno.test("ending a call invalidates queued signals without blocking next call", async () => {
  const queue = createCallTaskQueue();
  let staleRan = false;
  let nextRan = false;
  const stale = queue.run(async () => { staleRan = true; });
  queue.reset();
  const next = queue.run(async () => { nextRan = true; });
  await Promise.all([stale, next]);
  assert(!staleRan, "ended call must not acquire microphone from queued work");
  assert(nextRan, "next call must still work");
});

Deno.test("a rejected signal does not poison future call recovery", async () => {
  const queue = createCallTaskQueue();
  let recovered = false;
  await queue.run(async () => { throw new Error("SDP rejected"); }).catch(() => {});
  await queue.run(async () => { recovered = true; });
  assert(recovered, "recovery must run after failed signal");
});
