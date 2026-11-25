import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("next/package.json"))("postcss");

const compatibilityCss = await readFile("app/avenzo-2.1.css", "utf8");
const compatibilityRoot = postcss.parse(compatibilityCss);
assert.ok(compatibilityRoot.nodes.some(node => node.type === "atrule" && node.name === "layer" && node.params === "avenzo-21"));
assert.match(compatibilityCss, /--accent:\s*#d2d7dd/i);
assert.match(compatibilityCss, /--av-violet:\s*#d2d7dd/i, "legacy token names must resolve to the approved metallic accent");
assert.match(compatibilityCss, /--av-secondary:\s*#8f99a4/i, "secondary accent must use neutral steel");
assert.match(compatibilityCss, /--av-bg:\s*#f5f6f7/i, "light surfaces must use the neutral palette");
assert.match(compatibilityCss, /html\[data-theme="light"\] \.social-app/);
assert.match(compatibilityCss, /prefers-reduced-motion:\s*reduce/);
assert.match(compatibilityCss, /min-width:\s*44px/);
assert.doesNotMatch(compatibilityCss, /#c9f34e|#dfff91|#718d2d|#526b1c|rgba\(\s*201\s*,\s*243\s*,\s*78/i, "stale lime/olive accent values must not remain");
assert.doesNotMatch(compatibilityCss, /#[0-9a-f]{3,8}\s*;[^\n]*(?:violet|purple)/i);

const designCss = await readFile("app/avenzo-design-system.css", "utf8");
const designRoot = postcss.parse(designCss);
assert.ok(designRoot.nodes.length > 0, "canonical design system must parse as CSS");
assert.match(designCss, /AVENZO PREMIUM EDITION — INTERACTION FINISH/);
assert.match(designCss, /--avenzo-premium-duration:/);
assert.match(designCss, /prefers-reduced-motion:\s*reduce/);
assert.match(designCss, /:active/);
console.log("AVENZO Premium Edition checks passed: Obsidian Chrome compatibility, light theme, reduced motion, accessible touch targets, and shared interaction states.");
