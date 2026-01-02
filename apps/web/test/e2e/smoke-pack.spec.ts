import { test, expect } from "@playwright/test";

function corsHeadersFor(routeUrl: string, origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Mock-Route": routeUrl,
  };
}

async function mockCoreApis(page: import("@playwright/test").Page) {
  // Preferences (theme/tone) are touched by Layout + Chat.
  await page.route("**/v1/preferences**", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = {
      ...corsHeadersFor(route.request().url(), origin),
      "Content-Type": "application/json",
    };

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    const url = route.request().url();
    const key = decodeURIComponent(url.split("/v1/preferences/")[1] ?? "");

    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        headers,
        json: { key, value: "default", updatedAt: Date.now(), isDefault: true },
      });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      json: { key, value: "default", updatedAt: Date.now(), isDefault: false },
    });
  });

  await page.route("**/v1/conversations**", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    await route.fulfill({ status: 200, headers, json: [] });
  });

  await page.route("**/v1/episodic**", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    // Keep it simple: empty history.
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, headers, json: [] });
      return;
    }

    // For POST (write), respond with a minimal shape expected by api.episodic.create.
    await route.fulfill({
      status: 200,
      headers,
      json: { success: true, id: "epi-1", receipt: { allowed: true } },
    });
  });

  await page.route("**/v1/receipts**", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      json: [
        {
          id: "rcpt-1",
          timestamp: Date.now(),
          action: "allow",
          allowed: true,
          reason: "mock: ok",
        },
      ],
    });
  });
}

test("smoke: navigation works", async ({ page }) => {
  await mockCoreApis(page);

  await page.goto("/chat");
  // Prefer a stable, interactive readiness signal over a potentially animated heading.
  await expect(
    page.getByRole("textbox", { name: "Message input" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Receipts" }).click();
  await expect(page.getByRole("heading", { name: "Receipts" })).toBeVisible();
});

test("smoke: mobile can open conversations drawer and operator sheet", async ({
  page,
}) => {
  await mockCoreApis(page);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/chat");

  await page.getByTestId("conversations-drawer-toggle").click();
  await expect(page.getByTestId("conversations-drawer")).toBeVisible();

  // Close the drawer before interacting with controls behind it.
  // The drawer covers ~85% from the left; click the visible scrim area on the right.
  await page.getByTestId("conversations-scrim").click({
    position: { x: 385, y: 10 },
  });
  await expect(page.getByTestId("conversations-drawer")).toBeHidden();

  await page.getByTestId("operator-panel-toggle").click();
  await expect(page.getByTestId("operator-panel")).toBeVisible();
  await expect(page.getByText("mock: ok")).toBeVisible();
});

test("smoke: desktop can toggle operator panel", async ({ page }) => {
  await mockCoreApis(page);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/chat");

  await page.getByTestId("operator-panel-toggle").click();
  await expect(page.getByTestId("operator-panel")).toBeVisible();
  await expect(page.getByText("mock: ok")).toBeVisible();
});
