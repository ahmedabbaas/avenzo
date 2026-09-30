import {
  countBy,
  groupBy,
} from "../lib/collections.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("groupBy preserves item order within each key", () => {
  const rows = [
    { post: "a", id: 1 },
    { post: "b", id: 2 },
    { post: "a", id: 3 },
  ];

  const grouped = groupBy(rows, (row) => row.post);

  assert(grouped.get("a")?.length === 2, "post a should contain two rows");
  assert(grouped.get("a")?.[0].id === 1, "first grouped row should keep order");
  assert(grouped.get("a")?.[1].id === 3, "second grouped row should keep order");
  assert(grouped.get("b")?.[0].id === 2, "post b should contain its row");
});

Deno.test("countBy counts each key without mutating input", () => {
  const rows = [
    { conversation: "one" },
    { conversation: "one" },
    { conversation: "two" },
  ];

  const counts = countBy(rows, (row) => row.conversation);

  assert(counts.get("one") === 2, "conversation one should count twice");
  assert(counts.get("two") === 1, "conversation two should count once");
  assert(rows.length === 3, "source rows should remain unchanged");
});
