import { test, expect } from "@playwright/test";

test("errors page shows empty state", async ({ page }) => {
  await page.goto("/errors");
  await expect(
    page.getByRole("heading", { name: "Errors", level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByText("No errors recorded in this browser yet."),
  ).toBeVisible();
});
