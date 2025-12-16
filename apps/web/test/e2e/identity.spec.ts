import { expect, test } from "@playwright/test";

test.describe("Identity Preferences", () => {
  test.beforeEach(async ({ page }) => {
    // Mock GET /v1/identity with user_preferences
    await page.route("**/v1/identity", async (route) => {
      const headers = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };

      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 200, headers });
        return;
      }

      if (route.request().method() === "GET") {
        await route.fulfill({
          headers,
          json: [
            {
              key: "user_preferences",
              id: "pref-1",
              created_at: Date.now(),
              value: {},
              provenance: {},
              hash: "h",
              preferred_tone: "casual",
              memory_retention_days: 30,
              interface_theme: "dark",
            },
            {
              key: "user_name",
              id: "id-1",
              created_at: Date.now(),
              value: "Dreamboat",
              provenance: {},
              hash: "h2",
            },
          ],
        });
      }

      // Mock POST /v1/identity
      if (route.request().method() === "POST") {
        await route.fulfill({
          headers,
          json: { success: true, id: "new-id" },
        });
      }
    });
  });

  test("should display and edit preferences", async ({ page }) => {
    await page.goto("/identity");

    // Check Header
    await expect(page.getByText("Identity & Preferences")).toBeVisible();

    // Check Preference Fields Existence
    await expect(page.getByLabel("Preferred Tone")).toBeVisible();
    await expect(page.getByLabel("Memory Retention (Days)")).toBeVisible();
    await expect(page.getByLabel("Interface Theme")).toBeVisible();

    // Verify initial values from mock
    await expect(page.getByLabel("Preferred Tone")).toHaveValue("casual");
    await expect(page.getByLabel("Memory Retention (Days)")).toHaveValue("30");

    // Edit Preferences (Triggers Auto-Save)
    const savePromise = page.waitForResponse(
      (response) =>
        response.url().includes("/v1/identity") &&
        response.request().method() === "POST",
    );

    await page.getByLabel("Preferred Tone").selectOption("formal");

    // Verify Request for Tone
    const response = await savePromise;
    const requestBody = response.request().postDataJSON();

    expect(requestBody.key).toBe("user_preferences");
    expect(requestBody.preferred_tone).toBe("formal");

    // Update other fields (just ensure they don't crash)
    await page.getByLabel("Memory Retention (Days)").fill("60");
    await page.getByLabel("Interface Theme").selectOption("light");

    // We assume if one works, others trigger mutation too.
  });
});
