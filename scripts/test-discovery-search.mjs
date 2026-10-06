import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

const source = await readFile("features/social/lib/discovery-search.ts", "utf8");
const context = { exports:{} };
vm.runInNewContext(ts.transpileModule(source, {
  compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 },
}).outputText, context);
const { discoveryTerm, discoveryTextFilter } = context.exports;
assert.equal(discoveryTerm("  @ahmed.abbas  "), "ahmed.abbas");
assert.equal(discoveryTerm("#پاکستان"), "پاکستان");
assert.equal(discoveryTerm("two   words"), "two words");
for (const unsafe of ["", "@", "x".repeat(121), "name,author_id.eq.secret", "name)or(id.eq.any)", 'name"', "name\\", "%", "<script>"]) {
  assert.equal(discoveryTerm(unsafe), null, unsafe);
}
assert.equal(discoveryTextFilter(["username", "display_name"], "ali_name"),
  'username.ilike."%ali\\\\_name%",display_name.ilike."%ali\\\\_name%"');
console.log("Discovery search tests passed: input bounds, Unicode, token normalization and filter injection rejection.");
