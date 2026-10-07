import { test } from "node:test";
import assert from "node:assert/strict";
import { commitAndRefresh } from "../features/social/lib/commit-and-refresh.ts";
import { groupStoriesForTray } from "../features/social/lib/story-tray.ts";

test("a committed comment stays successful when reload fails, preventing duplicate retries", async () => {
  let writes = 0;
  assert.deepEqual(await commitAndRefresh(async () => { writes++; }, async () => { throw new Error("offline"); }), { saved: true, refreshed: false });
  assert.equal(writes, 1);
});
test("a rejected comment preserves retry state and does not reload", async () => {
  let reloads = 0;
  assert.deepEqual(await commitAndRefresh(async () => { throw new Error("permission denied"); }, async () => { reloads++; }), { saved: false, refreshed: false });
  assert.equal(reloads, 0);
  assert.deepEqual(await commitAndRefresh(async () => {}, async () => {}), { saved: true, refreshed: true });
});
test("story tray deduplicates authors without losing unseen stories or mutating input", () => {
  const stories = [
    { id: "a-new", author_id: "a", viewed: false, created_at: "2026-10-07T12:00:00Z" },
    { id: "b-seen", author_id: "b", viewed: true, created_at: "2026-10-07T10:00:00Z" },
    { id: "a-old", author_id: "a", viewed: true, created_at: "2026-10-07T09:00:00Z" },
    { id: "a-unseen", author_id: "a", viewed: false, created_at: "2026-10-07T11:00:00Z" },
  ];
  const before = structuredClone(stories);
  assert.deepEqual(groupStoriesForTray(stories).map(story => story.id), ["a-unseen", "b-seen"]);
  assert.deepEqual(stories, before);
  assert.deepEqual(groupStoriesForTray([]), []);
});
