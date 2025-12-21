import { expect, test } from "@playwright/test";

test.describe("Visual Regression Smoke Tests", () => {
  test("Mobile (iPhone 15) Layout", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/chat");

    // Ensure core elements are present before snapshot
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await expect(page.locator("aside")).not.toBeVisible(); // Sidebar hidden on mobile

    // Visual Snapshot
    await expect(page).toHaveScreenshot("mobile-chat-initial.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  test("Tablet Layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/chat");

    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    // Sidebar logic depends on state, but default might be visible or hidden depending on implementation.
    // Assuming default behavior on tablet.

    await expect(page).toHaveScreenshot("tablet-chat-initial.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  test("Desktop Layout", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/chat");

    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await expect(page.locator("aside")).toBeVisible(); // Sidebar visible on desktop

    await expect(page).toHaveScreenshot("desktop-chat-initial.png", {
      maxDiffPixelRatio: 0.1,
    });
  });
});
