import { expect, test } from "@playwright/test";

test.describe("Async Summarization", () => {
  test.beforeEach(async ({ page }) => {
    // Mock Identity for initial load
    await page.route("**/v1/identity", async (route) => {
      const origin =
        route.request().headers()["origin"] ?? "http://localhost:5173";
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers });
      }
      await route.fulfill({ status: 200, headers, json: [] });
    });

    await page.route("**/v1/episodic*", async (route) => {
      const origin =
        route.request().headers()["origin"] ?? "http://localhost:5173";
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({ status: 204, headers });
      }
      await route.fulfill({ status: 200, headers, json: [] });
    });

    // Mock Search Results
    await page.route("**/v1/semantic/search*", async (route) => {
      const origin =
        route.request().headers()["origin"] ?? "http://localhost:5173";
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 200, headers });

      await route.fulfill({
        headers,
        json: [
          { id: "1", content: "Result 1", score: 0.9, createdAt: Date.now() },
          { id: "2", content: "Result 2", score: 0.8, createdAt: Date.now() },
        ],
      });
    });
  });

  test("should handle async summarization queue flow", async ({ page }) => {
    await page.goto("/memory");
    await page.getByRole("button", { name: "Semantic Search" }).click(); // Switch tab

    // Perform Search
    await page.getByPlaceholder("Search semantic memory...").fill("test");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(page.getByText("2 Results")).toBeVisible();

    // Mock Summarize Start -> Queue
    await page.route("**/v1/semantic/summarize", async (route) => {
      const origin =
        route.request().headers()["origin"] ?? "http://localhost:5173";
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      if (route.request().method() === "OPTIONS")
        return route.fulfill({ status: 200, headers });

      await route.fulfill({
        status: 202,
        headers,
        json: { success: true, jobId: "job-123", status: "queued" },
      });
    });

    // Mock Job Status Polling
    let pollCount = 0;
    await page.route("**/v1/jobs/job-123", async (route) => {
      const origin =
        route.request().headers()["origin"] ?? "http://localhost:5173";
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Credentials": "true",
        Vary: "Origin",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      };
      pollCount++;
      if (pollCount === 1) {
        await route.fulfill({
          status: 200,
          headers,
          json: { id: "job-123", status: "queued" },
        });
      } else if (pollCount === 2) {
        await route.fulfill({
          status: 200,
          headers,
          json: { id: "job-123", status: "processing" },
        });
      } else {
        await route.fulfill({
          status: 200,
          headers,
          json: {
            id: "job-123",
            status: "completed",
            result: { summary: "This is the AI generated summary." },
          },
        });
      }
    });

    // Click Summarize
    await page.getByRole("button", { name: "Summarize with AI" }).click();

    // Verify Loading State
    const summarizeButton = page.getByRole("button", {
      name: "Summarizing...",
    });
    await expect(summarizeButton).toBeVisible();
    await expect(summarizeButton).toBeDisabled();

    // Verify Completion
    await expect(page.getByText("AI Summary")).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText("This is the AI generated summary."),
    ).toBeVisible();

    // Verify Button Reset
    await expect(
      page.getByRole("button", { name: "Summarize with AI" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Summarize with AI" }),
    ).toBeEnabled();
  });
});
