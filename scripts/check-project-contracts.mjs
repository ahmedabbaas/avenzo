import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();

function fail(message) {
  throw new Error("[AVENZO contract] " + message);
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

function requireText(content, needle, label) {
  if (!content.includes(needle)) {
    fail(label + " is missing: " + needle);
  }
}

function forbidText(content, needle, label) {
  if (content.toLowerCase().includes(needle.toLowerCase())) {
    fail(label + " contains forbidden legacy value: " + needle);
  }
}

async function walk(relativeDir) {
  const absolute = path.join(root, relativeDir);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(relativePath));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

const layout = await read("app/layout.tsx");
const globals = await read("app/globals.css");
const design = await read("app/avenzo-design-system.css");
const adTheme = await read("app/avenzo-ad-theme.css");
const nativeMobile = await read("mobile-shell/app-mobile.css");
const capacitor = await read("capacitor.config.ts");
const nextConfig = await read("next.config.ts");

const designImport = 'import "./avenzo-design-system.css";';
const adImport = 'import "./avenzo-ad-theme.css";';

requireText(layout, designImport, "Root layout");
requireText(layout, adImport, "Root layout");

if (layout.indexOf(designImport) < layout.indexOf(adImport)) {
  fail("avenzo-design-system.css must load after avenzo-ad-theme.css");
}

requireText(
  design,
  "AVENZO DESIGN SYSTEM — PHASE 1 STABILIZATION",
  "Design system"
);
requireText(design, "--av-accent:#7c6cff", "Design system");
requireText(design, "--av-coral:#ff5f8f", "Design system");

if (globals.includes("/* AVENZO AURORA UI v1 */")) {
  fail("the final product theme must not be appended back into globals.css");
}

const forbiddenLegacyAccents = [
  "#c8ff38",
  "#dfff63",
  "#cfff35",
  "#dcff5a",
  "#d8ff45",
  "#bce92d",
  "#d8ff3f",
  "#d9ff3f",
  "#b8f126",
];

for (const [label, content] of [
  ["globals.css", globals],
  ["avenzo-design-system.css", design],
  ["avenzo-ad-theme.css", adTheme],
  ["mobile-shell/app-mobile.css", nativeMobile],
]) {
  for (const token of forbiddenLegacyAccents) {
    forbidText(content, token, label);
  }
}

requireText(capacitor, 'url: "https://avenzo-ivory.vercel.app"', "Capacitor config");
requireText(capacitor, "cleartext: false", "Capacitor config");
requireText(capacitor, 'backgroundColor: "#090a0d"', "Capacitor config");

for (const header of [
  "Content-Security-Policy",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Referrer-Policy",
  "Permissions-Policy",
  "Strict-Transport-Security",
]) {
  requireText(nextConfig, header, "Next security headers");
}

// Browser/mobile code must never gain a Supabase service-role credential.
const sourceRoots = ["app", "components", "features", "lib", "mobile-shell"];
for (const sourceRoot of sourceRoots) {
  const files = await walk(sourceRoot);

  for (const relativePath of files) {
    if (!/\.(?:ts|tsx|js|mjs)$/.test(relativePath)) continue;
    const source = await read(relativePath);

    if (
      /SUPABASE_SERVICE_ROLE/i.test(source) ||
      /service_role\s*[:=]/i.test(source)
    ) {
      fail(relativePath + " appears to expose a Supabase service-role credential");
    }
  }
}

console.log("AVENZO project contracts passed.");
