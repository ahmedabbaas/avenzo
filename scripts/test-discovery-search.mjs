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

assert.equal(discoveryTextFilter(["username", "display_name"], "A", true),
  'username.ilike."A%",display_name.ilike."A%"');
assert.equal(discoveryTerm("A"), "A", "one-letter searches are accepted");

// Exercise the actual query orchestration with a deterministic RLS-visible dataset.
const querySource = await readFile("features/social/data/queries.ts", "utf8");
const queryContext = { exports:{}, require: name => {
  if (name.endsWith("discovery-search")) return context.exports;
  if (name.endsWith("collections")) return {};
  throw new Error("Unexpected dependency " + name);
}};
vm.runInNewContext(ts.transpileModule(querySource, {
  compilerOptions:{ module:ts.ModuleKind.CommonJS, target:ts.ScriptTarget.ES2022 },
}).outputText, queryContext);
function matches(value, pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*");
  return new RegExp("^" + escaped + "$", "i").test(value);
}
function client(prefixCount) {
  const rows = [
    ...Array.from({length:prefixCount}, (_, i) => ({id:"prefix-"+i, username:"a"+String(i).padStart(3,"0"), display_name:"Prefix " + i})),
    ...Array.from({length:40}, (_, i) => ({id:"contains-"+i, username:"za"+String(i).padStart(3,"0"), display_name:"Related " + i})),
  ];
  return { from(table) {
    let data = table === "profiles" ? [...rows] : [], from = 0, to = Infinity;
    const builder = {
      select() { return builder; },
      or(filter) {
        const patterns = [...filter.matchAll(/(username|display_name)\.ilike\.("(?:\\.|[^"])*")/g)].map(m => [m[1], JSON.parse(m[2])]);
        if (table === "profiles") data = data.filter(row => patterns.some(([column, pattern]) => matches(row[column], pattern)));
        return builder;
      },
      not(column, _operator, pattern) { data = data.filter(row => !matches(row[column], pattern)); return builder; },
      order(column, {ascending}) { data.sort((a,b) => ascending ? a[column].localeCompare(b[column]) : b[column].localeCompare(a[column])); return builder; },
      range(a,b) { from=a; to=b; return builder; },
      limit(n) { to=n-1; return builder; },
      then(resolve) { return Promise.resolve({data:data.slice(from,to+1),count:data.length,error:null}).then(resolve); },
    };
    return builder;
  }};
}
for (const peopleOnly of [false, true]) for (const prefixCount of [0, 1, 23, 24, 25, 48, 50]) {
  const ids = [];
  for (let page=0; page<6; page++) {
    const result = await queryContext.exports.searchDiscovery(client(prefixCount), "viewer", "a", page, peopleOnly);
    if (peopleOnly) { assert.equal(result.posts.length, 0); assert.equal(result.reels.length, 0); }
    ids.push(...result.people.map(row => row.id));
    if (!result.hasMore) break;
  }
  assert.equal(ids.length, prefixCount+40, "pagination retains all matches: " + prefixCount);
  assert.equal(new Set(ids).size, ids.length, "pagination has no duplicates");
  assert.ok(ids.slice(0,prefixCount).every(id => id.startsWith("prefix-")), "prefix profiles rank ahead of contains matches");
}
console.log("Discovery query checks passed: one-letter results, prefix priority and pagination boundaries.");
