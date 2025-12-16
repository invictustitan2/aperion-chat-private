import { Env } from "../types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function cleanupLogs(_env: Env) {
  // Delete logs older than 7 days
  const _sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Cleanup logic for dev_logs is removed as we migrated to Workers Observability.
  // This function can be expanded for other cleanup tasks (e.g. old receipts).

  return { deleted: 0 };
}
