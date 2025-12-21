import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(process.cwd());

const distDir = path.join(repoRoot, "apps", "web", "dist");

const forbiddenSubstrings = ["VITE_AUTH_TOKEN", "Ensure VITE_AUTH_TOKEN"];

function walkFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

function isProbablyTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return [
    ".js",
    ".mjs",
    ".cjs",
    ".css",
    ".html",
    ".map",
    ".json",
    ".txt",
  ].includes(ext);
}

function scanFile(filePath) {
  if (!isProbablyTextFile(filePath)) return [];
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch {
    return [];
  }
  const hits = [];
  for (const needle of forbiddenSubstrings) {
    const idx = content.indexOf(needle);
    if (idx !== -1) {
      hits.push({ needle, index: idx });
    }
  }
  return hits;
}

if (!fs.existsSync(distDir) || !fs.statSync(distDir).isDirectory()) {
  console.error(
    `guard:prod-secrets: missing build output at ${path.relative(repoRoot, distDir)}. Run a web build first (e.g. pnpm -r build).`,
  );
  process.exit(1);
}

const files = walkFiles(distDir);
const failures = [];

for (const file of files) {
  const hits = scanFile(file);
  if (hits.length) {
    failures.push({ file, hits });
  }
}

if (failures.length) {
  console.error(
    "guard:prod-secrets: forbidden strings found in web build output:",
  );
  for (const f of failures) {
    const rel = path.relative(repoRoot, f.file);
    for (const h of f.hits) {
      console.error(`- ${rel}: contains '${h.needle}'`);
    }
  }
  process.exit(1);
}

console.log("guard:prod-secrets: OK (no forbidden prod auth hints in dist)");
