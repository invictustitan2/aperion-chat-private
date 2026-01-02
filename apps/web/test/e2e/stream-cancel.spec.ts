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

test("can cancel a streaming response", async ({ page }) => {
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

    await route.fulfill({
      status: 200,
      headers,
      json: { key, value: "default", updatedAt: Date.now(), isDefault: true },
    });
  });

  await page.route("**/v1/episodic*", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = corsHeadersFor(route.request().url(), origin);

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, headers, json: [] });
      return;
    }

    await route.fulfill({
      status: 200,
      headers,
      json: { success: true, id: "epi-1", receipt: { allowed: true } },
    });
  });

  // Delay the SSE response so we can click Cancel before it resolves.
  await page.route("**/v1/chat/stream", async (route) => {
    const origin =
      route.request().headers()["origin"] ?? "http://localhost:5173";
    const headers = {
      ...corsHeadersFor(route.request().url(), origin),
      "Content-Type": "text/event-stream",
    };

    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 200, headers });
      return;
    }

    await new Promise((r) => setTimeout(r, 3000));

    // If the request was aborted, fulfill may throw; ignore.
    try {
      const body = 'data: {"token":"TOO-LATE"}\n' + "data: [DONE]\n";
      await route.fulfill({ status: 200, headers, body });
    } catch {
      // ignore
    }
  });

  await page.goto("/chat");

  const composer = page.getByRole("textbox", { name: "Message input" });
  await composer.fill("Cancel test");
  await page.getByRole("button", { name: "Send message" }).click();

  const cancel = page.getByTestId("stream-cancel");
  await expect(cancel).toBeVisible();
  await cancel.click();

  await expect(cancel).toBeHidden();
  await expect(page.getByText("TOO-LATE")).toBeHidden();
});
