import { test } from "node:test";
import assert from "node:assert/strict";
import { sortFeedPosts } from "../features/social/lib/feed-ranking.ts";

function post(id, created_at, likeCount, commentCount) {
  return { id, created_at, likeCount, commentCount };
}

test("latest feed sorts newest first without mutating source", () => {
  const source = [post("old", "2026-01-01T00:00:00Z", 50, 20), post("new", "2026-01-03T00:00:00Z", 0, 0)];
  const sorted = sortFeedPosts(source, "latest");
  assert.deepEqual(sorted.map(item => item.id), ["new", "old"]);
  assert.equal(source[0].id, "old");
});

test("top feed ranks real engagement and uses recency for ties", () => {
  const source = [
    post("low", "2026-01-03T00:00:00Z", 1, 0),
    post("top", "2026-01-01T00:00:00Z", 10, 5),
    post("tie-new", "2026-01-04T00:00:00Z", 2, 2),
    post("tie-old", "2026-01-02T00:00:00Z", 2, 2),
  ];
  assert.deepEqual(sortFeedPosts(source, "top").map(item => item.id), ["top", "tie-new", "tie-old", "low"]);
});

test("top ranking safely handles negative engagement counts", () => {
  const source = [post("bad", "2026-01-02T00:00:00Z", -3, -2), post("good", "2026-01-01T00:00:00Z", 1, 0)];
  assert.deepEqual(sortFeedPosts(source, "top").map(item => item.id), ["good", "bad"]);
});
