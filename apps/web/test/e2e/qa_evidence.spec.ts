import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

// Define iPhone 15 viewport exactly as requested
const IPHONE_15 = { width: 393, height: 852 };

test.use({
  viewport: IPHONE_15,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test.describe("Phase 5 RC: iPhone 15 Evidence Pack", () => {
  const screenshotDir = "apps/web/docs/qa/screenshots";

  let episodicRecords: Array<{
    id: string;
    content: string;
    createdAt: number;
    provenance: Record<string, unknown>;
  }> = [];

  test.beforeAll(() => {
    mkdirSync(screenshotDir, { recursive: true });
  });

  test.beforeEach(async ({ page }) => {
    episodicRecords = [];

    // Mock API responses to simulate backend
    await page.route("**/v1/conversations**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (!url.pathname.endsWith("/v1/conversations")) {
        await route.continue();
        return;
      }

      if (req.method() === "POST") {
        const body = {
          id: "conv-new-123",
          title: "New Chat",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
        return;
      }

      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              id: "conv-123",
              title: "Existing Conversation",
              createdAt: Date.now(),
              updatedAt: Date.now(),
            },
          ]),
        });
        return;
      }

      await route.continue();
    });

    await page.route("**/v1/chat/stream", async (route) => {
      // Static SSE body (intentionally non-streaming in Playwright fulfill)
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body:
          'data: {"token": "Hello "}\n\n' +
          'data: {"token": "from "}\n\n' +
          'data: {"token": "QA"}\n\n' +
          "data: [DONE]\n\n",
      });
    });

    // Mock episodic list + create (Chat UI reads history from GET /v1/episodic and
    // writes user messages to POST /v1/episodic).
    await page.route("**/v1/episodic**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (!url.pathname.endsWith("/v1/episodic")) {
        await route.continue();
        return;
      }

      if (req.method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(episodicRecords),
        });
        return;
      }

      if (req.method() === "POST") {
        const body = (await req.postDataJSON()) as {
          content?: string;
          provenance?: Record<string, unknown>;
        };

        const id = `epi-${episodicRecords.length + 1}`;
        episodicRecords.push({
          id,
          content: String(body.content ?? ""),
          createdAt: Date.now(),
          provenance: body.provenance ?? {},
        });

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true, id, receipt: {} }),
        });
        return;
      }

      await route.continue();
    });

    // Mock semantic creation (optional but good to have)
    await page.route("**/v1/semantic", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, id: "sem-123", receipt: {} }),
      });
    });

    // Navigate to localhost (mapped to production assumption)
    await page.goto("/chat");
  });

  test("Task 1 & 2: Baseline Screenshots & Flow Verification", async ({
    page,
  }) => {
    const openDrawer = page.getByTestId("conversations-drawer-toggle");
    const drawer = page.getByTestId("conversations-drawer");
    const drawerScrim = page.getByTestId("conversations-scrim");
    const input = page.getByPlaceholder("Type a message...");

    await test.step("A) Open conversations drawer and screenshot index", async () => {
      await expect(openDrawer).toBeVisible();
      await openDrawer.click();

      await expect(drawer).toBeVisible();
      await expect(
        drawer.getByPlaceholder("Search conversations..."),
      ).toBeVisible();

      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-chat-index.png`,
      });
    });

    await test.step("B) Create new conversation and close drawer", async () => {
      const newConvBtn = drawer.getByTestId("new-conversation");
      await expect(newConvBtn).toBeVisible();
      await newConvBtn.click();

      // Close the drawer so it doesn't intercept taps/clicks in the main view.
      await expect(drawerScrim).toBeVisible();

      // Important: Playwright clicks the element center by default, but the drawer covers
      // most of the scrim; a center click is intercepted. Compute a point *outside* the
      // drawer from its bounding box (resilient to width tweaks).
      const drawerBox = await drawer.boundingBox();
      if (!drawerBox) throw new Error("Drawer bounding box not available");

      const viewport = page.viewportSize();
      if (!viewport) throw new Error("Viewport size not available");

      const margin = 12;

      // Click just to the right of the drawer; clamp within viewport.
      const clickX = Math.min(
        drawerBox.x + drawerBox.width + margin,
        viewport.width - 2,
      );
      const clickY = Math.min(drawerBox.y + 40, viewport.height - 2);

      await page.mouse.click(clickX, clickY);
      await expect(drawer).toBeHidden();
    });

    await test.step("C) Focus composer and take screenshot", async () => {
      await expect(input).toBeVisible();
      await input.focus();
      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-composer-focus.png`,
      });
    });

    await test.step("D) Send message and screenshot detail", async () => {
      await input.fill("Hello world QA");
      const sendBtn = page.getByLabel("Send message");
      await expect(sendBtn).toBeEnabled();
      await sendBtn.click();

      // Wait for input to clear (avoids strict mode collision with textarea value)
      await expect(input).toHaveValue("");

      // Wait for message bubble to appear (history is refreshed after streaming ends).
      const userBubble = page
        .getByTestId("message-bubble")
        .filter({ has: page.getByText("Hello world QA") });
      await expect(userBubble).toBeVisible({ timeout: 10_000 });

      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-chat-detail.png`,
      });
    });

    await test.step("E) Message actions screenshot", async () => {
      const bubble = page
        .getByTestId("message-bubble")
        .filter({ has: page.getByText("Hello world QA") });
      await expect(bubble).toBeVisible();

      const shareBtn = bubble.getByLabel("Share message");
      await expect(shareBtn).toBeVisible();

      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-message-actions.png`,
      });
    });

    await test.step("F) Header actions + safe area screenshots", async () => {
      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-actions-row.png`,
        clip: { x: 0, y: 0, width: 393, height: 150 },
      });

      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-safe-area-top.png`,
        clip: { x: 0, y: 0, width: 393, height: 60 },
      });

      await page.screenshot({
        path: `${screenshotDir}/qa-iphone15-safe-area-bottom.png`,
        clip: { x: 0, y: 852 - 60, width: 393, height: 60 },
      });
    });

    await test.step("I) Back to conversations (open drawer)", async () => {
      await expect(openDrawer).toBeVisible();
      await openDrawer.click();
      await expect(drawer).toBeVisible();
    });
  });
});
