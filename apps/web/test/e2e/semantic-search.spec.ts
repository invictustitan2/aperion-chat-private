import { expect, test } from "@playwright/test";

test.describe("Semantic Search", () => {
  test("search tab displays search form", async ({ page }) => {
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

    await page.goto("/memory");

    // Click on Semantic Search tab
    await page.getByRole("button", { name: "Semantic Search" }).click();

    // Verify search form elements
    await expect(
      page.getByPlaceholder("Search semantic memory..."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Search", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("combobox")).toBeVisible(); // Limit selector
  });

  test("displays search results with scores", async ({ page }) => {
    // Mock search results
    await page.route("**/v1/semantic/search*", async (route) => {
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
            id: "sem-1",
            content: "This is a test semantic memory about AI systems",
            score: 0.92,
            createdAt: Date.now(),
            provenance: { source_type: "user", source_id: "test" },
            references: ["ep-1"],
          },
          {
            id: "sem-2",
            content: "Another memory about machine learning",
            score: 0.75,
            createdAt: Date.now() - 1000,
            provenance: { source_type: "system", source_id: "auto" },
            references: ["ep-2"],
          },
        ],
      });
    });

    // Mock identity endpoint
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

    await page.goto("/memory");

    // Switch to semantic search tab
    await page.getByRole("button", { name: "Semantic Search" }).click();

    // Enter search query
    await page.getByPlaceholder("Search semantic memory...").fill("AI systems");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    // Wait for results
    await expect(page.getByText("2 Results")).toBeVisible();

    // Verify score badges appear
    await expect(page.getByText("92.0%")).toBeVisible();
    await expect(page.getByText("75.0%")).toBeVisible();

    // Verify content appears
    await expect(
      page.getByText(/This is a test semantic memory/),
    ).toBeVisible();
    await expect(
      page.getByText(/Another memory about machine learning/),
    ).toBeVisible();

    // Verify summarize button appears
    await expect(
      page.getByRole("button", { name: "Summarize with AI" }),
    ).toBeVisible();
  });

  test("summarization works and shows AI summary", async ({ page }) => {
    // Mock search results
    await page.route("**/v1/semantic/search*", async (route) => {
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
            id: "sem-1",
            content: "Memory about AI",
            score: 0.9,
            createdAt: Date.now(),
            provenance: { source_type: "user", source_id: "test" },
            references: [],
          },
        ],
      });
    });

    // Mock summarize endpoint
    await page.route("**/v1/semantic/summarize", async (route) => {
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
        json: {
          summary: "This is an AI-generated summary of the search results.",
        },
      });
    });

    // Mock identity endpoint
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

    await page.goto("/memory");

    // Search
    await page.getByRole("button", { name: "Semantic Search" }).click();
    await page.getByPlaceholder("Search semantic memory...").fill("AI");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    // Wait for results then click summarize
    await expect(
      page.getByRole("button", { name: "Summarize with AI" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Summarize with AI" }).click();

    // Verify AI summary appears
    await expect(page.getByText("AI Summary")).toBeVisible();
    await expect(
      page.getByText("This is an AI-generated summary of the search results."),
    ).toBeVisible();
  });
});
