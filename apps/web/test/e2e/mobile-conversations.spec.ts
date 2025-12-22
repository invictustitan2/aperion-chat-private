import { expect, test, type Page } from "@playwright/test";

const corsHeaders = {
  "Access-Control-Allow-Origin": "http://localhost:5173",
  "Access-Control-Allow-Credentials": "true",
  Vary: "Origin",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

async function mockChatBackendForMobileDrawer(page: Page) {
  const conversations: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
  }> = [];

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
        body: JSON.stringify({ key, value: "default", updatedAt: Date.now() }),
      });
      return;
    }

    if (method === "PUT") {
      const key = route.request().url().split("/v1/preferences/")[1] || "";
      const body = route.request().postDataJSON() as { value?: unknown };
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify({
          key,
          value: body?.value,
          updatedAt: Date.now(),
        }),
      });
      return;
    }

    await route.continue();
  });

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
        body: JSON.stringify(conversations),
      });
      return;
    }

    if (method === "POST") {
      const conv = {
        id: `conv-${conversations.length + 1}`,
        title: "New Chat",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      };
      conversations.unshift(conv);
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(conv),
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
      // Keep it simple: empty history is fine for drawer tests.
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
      return;
    }

    await route.fulfill({ status: 200, headers: corsHeaders, body: "{}" });
  });
}

test("mobile conversations drawer can create/select conversation", async ({
  page,
}) => {
  // iPhone 15 Pro viewport
  await page.setViewportSize({ width: 393, height: 852 });
  await mockChatBackendForMobileDrawer(page);

  await page.goto("/chat");

  // Chat-first: composer visible.
  await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

  // Open drawer.
  await page.getByTestId("conversations-drawer-toggle").click();
  await expect(page.getByTestId("conversations-drawer")).toBeVisible();

  // Create conversation inside drawer.
  const createReq = page.waitForRequest(
    (req) => req.method() === "POST" && /\/v1\/conversations/.test(req.url()),
  );
  await page
    .getByTestId("conversations-drawer")
    .getByTestId("new-conversation")
    .click();
  await createReq;

  // Newly created conversation shows up and can be selected.
  const firstConversation = page.getByTestId("conversation-item").first();
  await expect(firstConversation).toBeVisible();
  await firstConversation.getByTestId("conversation-item-open").click();

  // Drawer closes on selection.
  await expect(page.getByTestId("conversations-drawer")).toHaveCount(0);

  // Active conversation enables Share button (title becomes the accessible name).
  await expect(
    page.getByRole("button", { name: "Copy shareable conversation link" }),
  ).toBeEnabled();
});
