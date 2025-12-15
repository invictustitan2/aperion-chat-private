import { Env } from "../index";

export async function cleanupLogs(env: Env): Promise<{ deleted: number }> {
  // Delete logs older than 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const result = await env.MEMORY_DB.prepare(
    "DELETE FROM dev_logs WHERE timestamp < ?",
  )
    .bind(sevenDaysAgo)
    .run();

  // Also clean up old episodic memories? Maybe later.
  // For now just system logs.

  return { deleted: result.meta.changes || 0 };
}
