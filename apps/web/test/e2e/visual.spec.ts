import { expect, test, type Page } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function mockChatBackend(page: Page) {
  await page.route("**/v1/conversations*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    if (method === "POST") {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          id: "conv-visual-1",
          title: "Visual",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        }),
      });
      return;
    }

    await route.fulfill({ status: 200, headers: corsHeaders, body: "{}" });
  });

  await page.route("**/v1/episodic*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === "GET") {
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });

  await page.route("**/v1/preferences/*", async (route) => {
    const method = route.request().method();
    if (method === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }

    if (method === "GET") {
      const key = route.request().url().split("/v1/preferences/")[1] || "";
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          key,
          value: "default",
          updatedAt: 1_700_000_000_000,
        }),
      });
      return;
    }

    if (method === "PUT") {
      const key = route.request().url().split("/v1/preferences/")[1] || "";
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          key,
          value: "default",
          updatedAt: 1_700_000_000_000,
        }),
      });
      return;
    }

    await route.continue();
  });
}

test.describe("Visual Regression Smoke Tests", () => {
  test("Mobile (iPhone 15) Layout", async ({ page }) => {
    await page.setViewportSize({ width: 393, height: 852 });
    await mockChatBackend(page);
    await page.goto("/chat");

    // Hard mobile mode is chat-first; composer should be visible immediately.
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // Chat sidebar is unmounted on mobile detail view.
    await expect(
      page.locator("aside").filter({ hasText: "Conversations" }),
    ).toHaveCount(0);

    // Visual Snapshot
    await expect(page).toHaveScreenshot("mobile-chat-initial.png", {
      maxDiffPixelRatio: 0.1,
    });
  });

  test("Tablet Layout", async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockChatBackend(page);
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
    await mockChatBackend(page);
    await page.goto("/chat");

    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await expect(
      page.locator("aside").filter({ hasText: "Conversations" }),
    ).toBeVisible();

    await expect(page).toHaveScreenshot("desktop-chat-initial.png", {
      maxDiffPixelRatio: 0.1,
    });
  });
});
