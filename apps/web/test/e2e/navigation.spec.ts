import { expect, test } from "@playwright/test";

test.describe("Navigation", () => {
  test("sidebar navigation works for all tabs", async ({ page }) => {
    // Mock API endpoints
    await page.route("**/v1/**", async (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 200, headers });
        return;
      }
      await route.fulfill({ headers, json: [] });
    });

    await page.goto("/");

    // Should redirect to /chat by default
    await expect(page).toHaveURL(/\/chat/);

    // Chat tab should be active
    await expect(page.getByRole("link", { name: "Chat" })).toBeVisible();

    // Navigate to Memory
    await page.getByRole("link", { name: "Memory" }).click();
    await expect(page).toHaveURL(/\/memory/);
    await expect(page.getByText("Memory Store")).toBeVisible();

    // Navigate to Identity
    await page.getByRole("link", { name: "Identity" }).click();
    await expect(page).toHaveURL(/\/identity/);
    await expect(page.getByText("Stored Identities")).toBeVisible();

    // Navigate to Receipts
    await page.getByRole("link", { name: "Receipts" }).click();
    await expect(page).toHaveURL(/\/receipts/);
    await expect(page.getByText("Decision Receipts")).toBeVisible();

    // Navigate to System Status
    await page.getByRole("link", { name: "System Status" }).click();
    await expect(page).toHaveURL(/\/status/);

    // Navigate to Settings
    await page.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(
      page.getByText("Configure application preferences"),
    ).toBeVisible();
  });

  test("identity page shows add form", async ({ page }) => {
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
      await route.fulfill({ headers, json: [] });
    });

    await page.goto("/identity");

    // Check header
    await expect(
      page.getByRole("heading", { name: "Identity & Preferences" }),
    ).toBeVisible();

    // Check add form exists
    await expect(page.getByPlaceholder("Key (e.g., user_name)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add Identity" }),
    ).toBeVisible();
  });

  test("settings page shows API status", async ({ page }) => {
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
      await route.fulfill({ headers, json: [] });
    });

    await page.goto("/settings");

    // Check sections exist
    await expect(page.getByText("API Status")).toBeVisible();
    await expect(page.getByText("Appearance")).toBeVisible();
    await expect(page.getByText("About")).toBeVisible();
    await expect(page.getByText("Infrastructure")).toBeVisible();

    // Prod-safety guardrail: settings must not render token/debug env-var hints.
    await expect(page.locator("body")).not.toContainText("VITE_AUTH_TOKEN");
    await expect(page.locator("body")).not.toContainText("Ensure VITE_");
    // Avoid obvious JWT/token patterns.
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toMatch(
      /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/,
    );
  });
});
