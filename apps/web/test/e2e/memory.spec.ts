import { test, expect } from "@playwright/test";

test("memory page displays identity and episodic", async ({ page }) => {
  // Mock API
  await page.route("**/v1/identity*", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }
    await route.fulfill({
      headers,
      json: [
        {
          id: "id-1",
          key: "user_name",
          value: "Test User",
          last_verified: Date.now(),
          createdAt: Date.now(),
          hash: "hash",
          provenance: {
            source_type: "system",
            source_id: "init",
            timestamp: Date.now(),
            confidence: 1,
          },
        },
      ],
    });
  });

  await page.route("**/v1/episodic*", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }
    await route.fulfill({
      headers,
      json: [
        {
          id: "123",
          content: "Test memory content",
          createdAt: Date.now(),
          hash: "hash",
          provenance: {
            source_type: "user",
            source_id: "operator",
            timestamp: Date.now(),
            confidence: 1,
          },
        },
      ],
    });
  });

  await page.goto("/memory");

  // Check Header
  await expect(page.getByText("Memory Store")).toBeVisible();

  // Check Identity Tab (default)
  await expect(page.getByText("user_name")).toBeVisible();
  await expect(page.getByText("Test User")).toBeVisible();

  // Switch to Episodic Tab
  await page.getByRole("button", { name: "Episodic Log" }).click();

  // Check Episodic Content
  await expect(page.getByText("Test memory content")).toBeVisible();
  await expect(page.getByText("user:operator")).toBeVisible();
});
