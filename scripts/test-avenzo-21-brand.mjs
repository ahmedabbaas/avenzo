import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("next/package.json"))("postcss");

const css = await readFile("app/avenzo-2.1.css", "utf8");
const root = postcss.parse(css);
assert.ok(root.nodes.some(node => node.type === "atrule" && node.name === "layer" && node.params === "avenzo-21"));
assert.match(css, /--accent:\s*#c9f34e/i);
assert.match(css, /--av-violet:\s*#c9f34e/i, "legacy violet token must resolve to AVENZO lime");
assert.match(css, /html\[data-theme="light"\] \.social-app/);
assert.match(css, /prefers-reduced-motion:\s*reduce/);
assert.match(css, /min-width:\s*44px/);
assert.doesNotMatch(css, /#[0-9a-f]{3,8}\s*;[^\n]*(?:violet|purple)/i);
console.log("AVENZO 2.1 brand checks passed: canonical lime tokens, light theme, reduced motion, and touch targets.");
