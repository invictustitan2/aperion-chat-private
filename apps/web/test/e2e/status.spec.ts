import { expect, test } from "@playwright/test";

test("system status page shows empty state", async ({ page }) => {
  // Mock API to return empty logs
  await page.route("**/api/dev/logs*", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }
    await route.fulfill({ headers, json: [] });
  });

  await page.goto("/status");
  await expect(
    page.getByRole("heading", { name: "System Status", level: 1 }),
  ).toBeVisible();

  await expect(page.getByText("No logs found for this filter.")).toBeVisible();
});
