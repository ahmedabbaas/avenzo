import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("features/social/lib/content-drafts.ts", "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function harness({ abort = false, rows = [] } = {}) {
  let closed = false;
  let usedUserIndex = false;
  const context = {
    exports: {}, crypto: { randomUUID: () => "draft-test" }, Date, Error, Promise,
    indexedDB: {
      open() {
        const open = {};
        queueMicrotask(() => {
          open.result = {
            close() { closed = true; },
            transaction() {
              const transaction = {};
              function request(result) {
                const request = { result };
                queueMicrotask(() => {
                  request.onsuccess?.();
                  // Abort after request success reproduces the old false-success bug.
                  queueMicrotask(() => {
                    if (abort) {
                      transaction.error = new Error("Quota exhausted after request success");
                      transaction.onabort?.();
                    } else transaction.oncomplete?.();
                  });
                });
                return request;
              }
              transaction.objectStore = () => ({
                index(name) {
                  assert.equal(name, "userId"); usedUserIndex = true;
                  return { getAll(userId) { return request(rows.filter(row => row.userId === userId)); } };
                },
                put(row) { return request(row.id); },
              });
              return transaction;
            },
          };
          open.onsuccess();
        });
        return open;
      },
    },
  };
  vm.runInNewContext(compiled, context);
  return { api: context.exports, state: () => ({ closed, usedUserIndex }) };
}

const reader = harness({ rows: [
  { id: "own-old", userId: "a", updatedAt: "2026-10-01T00:00:00Z" },
  { id: "other", userId: "b", updatedAt: "2026-10-06T00:00:00Z" },
  { id: "own-new", userId: "a", updatedAt: "2026-10-05T00:00:00Z" },
] });
assert.deepEqual(Array.from(await reader.api.listContentDrafts("a"), row => row.id), ["own-new", "own-old"]);
assert.deepEqual(reader.state(), { closed: true, usedUserIndex: true });

const writer = harness();
const saved = await writer.api.saveContentDraft({ userId: "a", mode: "post", caption: "test" });
assert.equal(saved.id, "draft-test");
assert.equal(writer.state().closed, true);

const failingWriter = harness({ abort: true });
await assert.rejects(failingWriter.api.saveContentDraft({ userId: "a", mode: "post" }), /Quota exhausted/);
assert.equal(failingWriter.state().closed, true);
console.log("Draft tests passed: account-scoped reads, commit success, late-abort rejection, connection cleanup.");
