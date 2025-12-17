import { expect, test } from "@playwright/test";

test("system status page shows empty state", async ({ page }) => {
  // The System Status page reads from a persisted client-side error log.
  // Ensure this test is isolated from any prior test run state.
  await page.addInitScript(() => {
    try {
      window.localStorage.removeItem("aperion:errorLog:v1");
    } catch {
      // ignore
    }
  });

  await page.goto("/status");
  await expect(
    page.getByRole("heading", { name: "System Status", level: 1 }),
  ).toBeVisible();

  await expect(page.getByText("No logs found for this filter.")).toBeVisible();
});
