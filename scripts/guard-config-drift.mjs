import fs from "node:fs/promises";
import path from "node:path";

function uniqSorted(values) {
  return Array.from(new Set(values)).sort();
}

function readLines(text) {
  return text.split(/\r?\n/);
}

function isHeaderLine(line) {
  return /^\s*\[\[?.+\]\]?\s*$/.test(line);
}

function parseWranglerVarNameListsTomlText(tomlText) {
  const requiredVarsByEnv = new Map();
  const optionalVarsByEnv = new Map();

  let currentEnv = "default";
  let inVarsBlock = false;

  for (const rawLine of readLines(tomlText)) {
    const line = rawLine.trim();

    if (isHeaderLine(line)) {
      inVarsBlock = false;

      const envVarsHeader = line.match(/^\[env\.([^\].]+)\.vars\]$/);
      if (envVarsHeader) {
        currentEnv = envVarsHeader[1];
        inVarsBlock = true;
        continue;
      }

      if (line === "[vars]") {
        currentEnv = "default";
        inVarsBlock = true;
        continue;
      }

      // Any other header exits vars collection; env remains whatever it was.
      continue;
    }

    if (!inVarsBlock) continue;

    const listStart = line.match(/^#\s*(required_vars|optional_vars)\s*:\s*$/);
    if (listStart) {
      const kind = listStart[1];

      // Consume following `# - NAME` lines in the same vars block. We do this by
      // letting the outer loop handle it; we just record "current kind".
      // Implemented via a small state machine below.
      //
      // This function is line-oriented, so we re-run with an index-based loop.
    }
  }

  // Re-parse with index-based loop to support consuming list blocks.
  currentEnv = "default";
  inVarsBlock = false;
  for (let i = 0; i < readLines(tomlText).length; i++) {
    const lineRaw = readLines(tomlText)[i];
    const line = lineRaw.trim();

    if (isHeaderLine(line)) {
      inVarsBlock = false;

      const envVarsHeader = line.match(/^\[env\.([^\].]+)\.vars\]$/);
      if (envVarsHeader) {
        currentEnv = envVarsHeader[1];
        inVarsBlock = true;
        continue;
      }

      if (line === "[vars]") {
        currentEnv = "default";
        inVarsBlock = true;
        continue;
      }

      continue;
    }

    if (!inVarsBlock) continue;

    const listStart = line.match(/^#\s*(required_vars|optional_vars)\s*:\s*$/);
    if (!listStart) continue;

    const kind = listStart[1];
    const target =
      kind === "required_vars" ? requiredVarsByEnv : optionalVarsByEnv;
    const existing = target.get(currentEnv) ?? [];

    for (let j = i + 1; j < readLines(tomlText).length; j++) {
      const next = readLines(tomlText)[j].trim();
      if (isHeaderLine(next)) break;

      const item = next.match(/^#\s*-\s*([A-Z0-9_]+)\s*$/);
      if (!item) break;

      existing.push(item[1]);
      i = j;
    }

    target.set(currentEnv, existing);
  }

  return {
    requiredVarsByEnv: new Map(
      Array.from(requiredVarsByEnv.entries()).map(([env, vars]) => [
        env,
        uniqSorted(vars),
      ]),
    ),
    optionalVarsByEnv: new Map(
      Array.from(optionalVarsByEnv.entries()).map(([env, vars]) => [
        env,
        uniqSorted(vars),
      ]),
    ),
  };
}

function parseWranglerBindingsTomlText(tomlText) {
  const bindingsByEnv = new Map();

  let currentEnv = "default";
  let currentSection = "";

  const addBinding = (env, name) => {
    const list = bindingsByEnv.get(env) ?? [];
    list.push(name);
    bindingsByEnv.set(env, list);
  };

  for (const rawLine of readLines(tomlText)) {
    const line = rawLine.trim();

    if (isHeaderLine(line)) {
      currentSection = line;

      const envTable = line.match(/^\[env\.([^\].]+)\]$/);
      const envSubtable = line.match(/^\[env\.([^\].]+)\./);
      const envArray = line.match(/^\[\[env\.([^\].]+)\./);

      if (envArray) currentEnv = envArray[1];
      else if (envSubtable) currentEnv = envSubtable[1];
      else if (envTable) currentEnv = envTable[1];
      else currentEnv = "default";

      continue;
    }

    const bindingMatch = line.match(/^binding\s*=\s*"([A-Z0-9_]+)"\s*$/);
    if (bindingMatch) {
      addBinding(currentEnv, bindingMatch[1]);
      continue;
    }

    // Durable Objects use `name = "CHAT_STATE"` in the bindings table.
    if (currentSection.endsWith("durable_objects.bindings]]")) {
      const doNameMatch = line.match(/^name\s*=\s*"([A-Z0-9_]+)"\s*$/);
      if (doNameMatch) {
        addBinding(currentEnv, doNameMatch[1]);
      }
    }
  }

  return new Map(
    Array.from(bindingsByEnv.entries()).map(([env, list]) => [
      env,
      uniqSorted(list),
    ]),
  );
}

function requirePresent({ name, missing, context }) {
  if (missing.length === 0) return;
  const lines = missing.map((m) => `- ${m}`).join("\n");
  throw new Error(`${name} missing in ${context}:\n${lines}`);
}

export async function validateConfigDrift(repoRoot) {
  const wranglerPath = path.join(repoRoot, "apps/api-worker/wrangler.toml");
  const wranglerText = await fs.readFile(wranglerPath, "utf8");

  // Required bindings for production behavior.
  // - MEMORY_DB: D1 backing store for chat + preferences + logs
  // - CHAT_STATE: Durable Object used for /v1/ws
  // - AI: Workers AI required by chat + streaming endpoints
  const requiredWorkerBindingsDefault = ["MEMORY_DB", "CHAT_STATE", "AI"];

  // Minimal required bindings for preview (PR deploys may omit optional features).
  const requiredWorkerBindingsPreview = ["MEMORY_DB", "CHAT_STATE"];

  const bindingsByEnv = parseWranglerBindingsTomlText(wranglerText);
  const defaultBindings = bindingsByEnv.get("default") ?? [];
  const previewBindings = bindingsByEnv.get("preview") ?? [];

  requirePresent({
    name: "Worker bindings",
    missing: requiredWorkerBindingsDefault.filter(
      (b) => !defaultBindings.includes(b),
    ),
    context: `${wranglerPath} (default env)`,
  });

  requirePresent({
    name: "Worker bindings",
    missing: requiredWorkerBindingsPreview.filter(
      (b) => !previewBindings.includes(b),
    ),
    context: `${wranglerPath} (env.preview)`,
  });

  // Required Worker env var names (not values) for access-mode production.
  const requiredWorkerVars = [
    "APERION_AUTH_MODE",
    "CF_ACCESS_TEAM_DOMAIN",
    "CF_ACCESS_AUD",
  ];
  const { requiredVarsByEnv } = parseWranglerVarNameListsTomlText(wranglerText);
  const declaredDefaultVars = requiredVarsByEnv.get("default") ?? [];
  const declaredPreviewVars = requiredVarsByEnv.get("preview") ?? [];

  requirePresent({
    name: "Worker required_vars",
    missing: requiredWorkerVars.filter((v) => !declaredDefaultVars.includes(v)),
    context: `${wranglerPath} ([vars] comment list)`,
  });

  requirePresent({
    name: "Worker required_vars",
    missing: requiredWorkerVars.filter((v) => !declaredPreviewVars.includes(v)),
    context: `${wranglerPath} ([env.preview.vars] comment list)`,
  });

  // Web (Pages) env vars: verify the app references VITE_API_BASE_URL.
  const webSrcRoot = path.join(repoRoot, "apps/web/src");
  const webFiles = await listFilesRecursive(
    webSrcRoot,
    (p) => p.endsWith(".ts") || p.endsWith(".tsx"),
  );
  const webText = await Promise.all(
    webFiles.map((p) => fs.readFile(p, "utf8")),
  );
  const webJoined = webText.join("\n");

  if (!webJoined.includes("import.meta.env.VITE_API_BASE_URL")) {
    throw new Error(
      "Web config drift: expected usage of import.meta.env.VITE_API_BASE_URL in apps/web/src, but none was found.",
    );
  }

  // Strong safety invariant: no VITE_AUTH_TOKEN references in web source.
  if (webJoined.includes("VITE_AUTH_TOKEN")) {
    throw new Error(
      "Web config drift: apps/web/src contains a reference to VITE_AUTH_TOKEN. The web UI must be Access-session-only and must not reference VITE_AUTH_TOKEN.",
    );
  }

  // Optional: verify VITE_AUTH_MODE exists (dev/test only). Do not fail if absent.

  return {
    worker: {
      bindingsByEnv,
      requiredWorkerBindingsDefault,
      requiredWorkerBindingsPreview,
      requiredWorkerVars,
    },
    web: {
      requiredPagesVars: ["VITE_API_BASE_URL"],
      optionalPagesVars: ["VITE_AUTH_MODE"],
    },
  };
}

async function listFilesRecursive(rootDir, predicate) {
  const out = [];

  async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile()) {
        if (!predicate || predicate(full)) out.push(full);
      }
    }
  }

  await walk(rootDir);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const repoRoot = process.cwd();
  validateConfigDrift(repoRoot)
    .then(() => {
      console.log("config-drift: ok");
    })
    .catch((err) => {
      console.error(String(err instanceof Error ? err.message : err));
      process.exitCode = 1;
    });
}
