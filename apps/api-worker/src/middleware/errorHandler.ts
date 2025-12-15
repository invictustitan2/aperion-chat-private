import { json } from "itty-router";

export function errorHandler(err: unknown): Response {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal server error";
  return json({ error: message }, { status: 500 });
}
