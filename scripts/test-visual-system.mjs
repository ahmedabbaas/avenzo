import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
const postcss = createRequire(require.resolve("next/package.json"))("postcss");
const design = postcss.parse(await readFile("app/avenzo-design-system.css", "utf8"));
// Installed APKs inject legacy CSS and React still emits inline display:none.
// These controls must have an unlayered important rule in the served stylesheet.
for (const [selector, expected] of [
  ["html.avenzo-android-app .avenzo-next .screen-profile .avenzo-mobile-profile-bar", "flex"],
  ["html.avenzo-android-app .avenzo-next .post-actions .post-action-icon-mobile", "grid"],
  ["html.avenzo-android-app .avenzo-next .rich-messages-workspace .dm-mobile-chat-head", "grid"],
  ["html.avenzo-android-app .avenzo-next .settings-mobile-reference", "grid"],
]) {
  let visible = false;
  design.walkRules(selector, rule => {
    let parent = rule.parent;
    while (parent) {
      assert.ok(parent.type !== "atrule" || parent.name !== "layer", "Native visibility repair must outrank compatibility layers");
      parent = parent.parent;
    }
    rule.walkDecls("display", decl => { visible ||= decl.important && decl.value === expected; });
  });
  assert.ok(visible, `${selector} must override inline hiding`);
}
const settingsHub = await readFile("features/settings/components/settings-hub.tsx", "utf8");
assert.ok(!/className="settings-mobile-reference"\s+style=/.test(settingsHub), "Settings must not be hidden by inline styling when Android hides its desktop alternative");
const premium = postcss.parse(await readFile("app/avenzo-premium.css", "utf8"));
for (const file of ["app/globals.css", "app/avenzo-ad-theme.css", "app/avenzo-premium.css"]) {
  const root = postcss.parse(await readFile(file, "utf8"));
  root.walkDecls(decl => assert.ok(!decl.important, `${file}: compatibility important rule overrides canonical UI: ${decl.prop}`));
  assert.equal(root.nodes[0].type === "comment" ? root.nodes[1].name : root.nodes[0].name, "layer");
}
const nativeRoot = postcss.parse(await readFile("mobile-shell/app-mobile.css", "utf8"));
assert.equal(nativeRoot.nodes[0].type === "comment" ? nativeRoot.nodes[1].name : nativeRoot.nodes[0].name, "layer");
assert.ok(premium.toString().includes("AVENZO PREMIUM OBSIDIAN — 2026-10-07"), "Premium Obsidian layer marker is missing");
design.walkAtRules("layer", layer => layer.walkDecls(decl => assert.ok(!decl.important, "Legacy layer cannot outrank the canonical UI")));

function tokens(selector) {
  const result = {};
  design.walkRules(selector, rule => rule.walkDecls(decl => { result[decl.prop] = decl.value; }));
  return result;
}
function luminance(hex) {
  let clean = hex.replace("#", "");
  if (clean.length === 3) clean = [...clean].map(char => char + char).join("");
  const rgb = [0, 2, 4].map(offset => parseInt(clean.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}
const dark = tokens(":root");
const light = { ...dark, ...tokens('html[data-theme="light"]') };
for (const [mode, theme] of [["dark", dark], ["light", light]]) {
  for (const text of ["--premium-text", "--premium-soft", "--premium-muted"]) {
    for (const background of ["--premium-bg", "--premium-surface", "--premium-secondary"]) {
      assert.ok(contrast(theme[text], theme[background]) >= 4.5, `${mode} ${text}/${background} fails readable text contrast`);
    }
  }
  assert.ok(contrast(theme["--premium-primary"], theme["--premium-on-primary"]) >= 4.5, "Primary button contrast");
}
for (const finish of ["citron", "ocean", "copper"]) {
  const theme = tokens(`html[data-theme="light"][data-finish="${finish}"]`);
  assert.ok(contrast(theme["--premium-finish"], light["--premium-surface"]) >= 4.5, `${finish} text contrast`);
}

const compiled = ts.transpileModule(await readFile("features/settings/lib/runtime-preferences.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const context = { exports: {}, require: () => ({ useEffect() {}, useState() {} }) };
vm.runInNewContext(compiled, context);
const normalize = context.exports.normalizeRuntimePreferences;
for (const bad of [null, [], "bad", 42, { data_saving_mode: "false", media_autoplay_videos: "false", language: "xx" }]) {
  const result = normalize(bad);
  assert.equal(result.data_saving_mode, false);
  assert.equal(result.media_autoplay_videos, true);
  assert.equal(result.language, "en");
}
const result = normalize({ data_saving_mode: true, media_autoplay_videos: false, language: "ur", unknown: true });
assert.equal(result.data_saving_mode, true);
assert.equal(result.media_autoplay_videos, false);
assert.equal(result.language, "ur");
assert.equal("unknown" in result, false);
console.log("Visual system checks passed: CSS parsing, premium layer priority, native compatibility parsing, light/dark contrast, malformed preference recovery.");
