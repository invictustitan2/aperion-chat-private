import path from "node:path";

export function resolveWithin(baseDir: string, relativePath: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, relativePath);
  const prefix = base.endsWith(path.sep) ? base : base + path.sep;

  if (resolved === base || resolved.startsWith(prefix)) return resolved;
  throw new Error("Path escapes base directory");
}
