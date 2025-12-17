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

  // Mock the theme preference call to prevent Layout from logging an error on 401/404
  await page.route("**/v1/preferences/theme", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ key: "theme", value: "system" }),
    });
  });

  await page.goto("/status");
  await expect(
    page.getByRole("heading", { name: "System Status", level: 1 }),
  ).toBeVisible();

  await expect(page.getByText("No logs found for this filter.")).toBeVisible();
});
