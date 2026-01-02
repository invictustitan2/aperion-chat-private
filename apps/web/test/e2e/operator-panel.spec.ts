import { test, expect } from "@playwright/test";

function corsHeadersFor(routeUrl: string, origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    Vary: "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Mock-Route": routeUrl,
  };
}

test("operator panel can open and show receipts", async ({ page }) => {
  // Minimal mocks to keep the app offline-safe.
  await page.route("**/v1/conversations*", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    await route.fulfill({ status: 200, headers, json: [] });
  });

  await page.route("**/v1/episodic*", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    await route.fulfill({ status: 200, headers, json: [] });
  });

  await page.route("**/v1/receipts*", async (route) => {
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

  await page.goto("/chat");

  const toggle = page.getByTestId("operator-panel-toggle");
  await expect(toggle).toBeVisible();
  await toggle.click();

  const panel = page.getByTestId("operator-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Receipts")).toBeVisible();
  await expect(panel.getByText("mock: ok")).toBeVisible();
});
