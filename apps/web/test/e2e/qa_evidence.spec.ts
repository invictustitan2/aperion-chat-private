import { expect, test } from "@playwright/test";

// Define iPhone 15 viewport exactly as requested
const IPHONE_15 = { width: 393, height: 852 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

test.use({
  viewport: IPHONE_15,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});

test.describe("Phase 5 RC: iPhone 15 Evidence Pack", () => {
  let conversations: Array<{
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
  }>;
  let episodic: Array<{
    id: string;
    createdAt: number;
    type: "episodic";
    content: string;
    hash: string;
    provenance: {
      source_type: "user" | "system" | "model" | "external";
      source_id: string;
      timestamp: number;
      confidence: number;
    };
    conversation_id?: string;
  }>;

  test.beforeEach(async ({ page }) => {
    conversations = [
      {
        id: "conv-123",
        title: "Existing Conversation",
        createdAt: 1_700_000_000_000,
        updatedAt: 1_700_000_000_000,
      },
    ];
    episodic = [];

    // Mock API responses to simulate backend
    await page.route("**/v1/conversations?limit=**", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: corsHeaders,
        contentType: "application/json",
        body: JSON.stringify(conversations),
      });
    });

    await page.route("**/v1/conversations", async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      // Create new conversation mock
      if (route.request().method() === "POST") {
        const body = {
          id: "conv-new-123",
          title: "New Chat",
          createdAt: 1_700_000_000_000,
          updatedAt: 1_700_000_000_000,
        };

        conversations = [body, ...conversations];
        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      } else {
        await route.continue();
      }
    });

    await page.route("**/v1/episodic?**", async (route) => {
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
          body: JSON.stringify(episodic),
        });
        return;
      }

      await route.continue();
    });

    await page.route("**/v1/episodic", async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      if (method === "POST") {
        const body = route.request().postDataJSON() as {
          content?: string;
          conversation_id?: string;
          provenance?: {
            source_type?: "user" | "system" | "model" | "external";
            source_id?: string;
            timestamp?: number;
            confidence?: number;
          };
        };

        const id = "msg-user-1";
        const createdAt = 1_700_000_000_001;
        episodic.push({
          id,
          createdAt,
          type: "episodic",
          content: String(body.content ?? ""),
          hash: "hash-user-1",
          provenance: {
            source_type: "user",
            source_id: "operator",
            timestamp: createdAt,
            confidence: 1,
          },
          ...(body.conversation_id
            ? { conversation_id: body.conversation_id }
            : {}),
        });

        await route.fulfill({
          status: 200,
          headers: corsHeaders,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            id,
            receipt: { allowed: true },
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.route("**/v1/chat/stream", async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
        body: 'data: {"token": "Hello from QA"}\n\ndata: [DONE]\n\n',
      });
    });

    // Navigate to localhost (mapped to production assumption)
    await page.goto("/chat");
  });

  test("Task 1 & 2: Baseline Screenshots & Flow Verification", async ({
    page,
  }, testInfo) => {
    const screenshotPath = (fileName: string) => testInfo.outputPath(fileName);

    // A) /chat opens to chat-first view (composer visible).
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // Open conversations drawer for index-style screenshot.
    await page.getByTestId("conversations-drawer-toggle").click();
    await expect(page.getByTestId("conversations-drawer")).toBeVisible();
    await expect(page.getByText("Conversations")).toBeVisible();
    await expect(
      page.getByPlaceholder("Search conversations..."),
    ).toBeVisible();

    // Screenshot: qa-iphone15-chat-index.png (drawer open)
    await page.screenshot({
      path: screenshotPath("qa-iphone15-chat-index.png"),
    });
    console.log("PASS: Flow A - Drawer View");

    // B) Create new conversation (inside drawer)
    const newConvBtn = page
      .getByTestId("conversations-drawer")
      .getByTestId("new-conversation");
    await expect(newConvBtn).toBeVisible();
    await newConvBtn.click();

    // Select the newly created conversation to close drawer.
    await expect(page.getByText("New Chat")).toBeVisible();
    await page.getByText("New Chat").click();
    await expect(page.getByTestId("conversations-drawer")).toHaveCount(0);

    // D) Send message
    const input = page.getByPlaceholder("Type a message...");
    await input.focus();
    // Screenshot: qa-iphone15-composer-focus.png
    await page.screenshot({
      path: screenshotPath("qa-iphone15-composer-focus.png"),
    });
    console.log("PASS: Flow C - Composer Focus");

    await input.fill("Hello world QA");
    const sendBtn = page.getByLabel("Send message");
    await sendBtn.click();

    // Wait for input to clear (avoids strict mode error matching input value)
    await expect(input).toHaveValue("", { timeout: 10000 });

    // Wait for message to appear
    await expect(page.getByText("Hello world QA")).toBeVisible();
    console.log("PASS: Flow D - Message Sent");

    // Screenshot: qa-iphone15-chat-detail.png (with content)
    await page.screenshot({
      path: screenshotPath("qa-iphone15-chat-detail.png"),
    });

    // qa-iphone15-message-actions.png
    // Hover or focus a message bubble to see actions? Or are they always visible on mobile?
    // Code says: "Mobile: Always visible. Desktop: Hover/Focus only" for opacity-100 logic.
    // So on mobile viewport they should be visible.
    // Actually the message bubble wrapper has the actions.
    const shareBtn = page.getByLabel("Share message").first();
    await expect(shareBtn).toBeVisible();
    await page.screenshot({
      path: screenshotPath("qa-iphone15-message-actions.png"),
    });

    // qa-iphone15-actions-row.png (Header actions)
    // The header is at the top.
    await page.screenshot({
      path: screenshotPath("qa-iphone15-actions-row.png"),
      clip: { x: 0, y: 0, width: 393, height: 150 },
    });

    // qa-iphone15-safe-area-top.png
    // We can infer this from the full screenshot, but let's take a dedicated crop
    await page.screenshot({
      path: screenshotPath("qa-iphone15-safe-area-top.png"),
      clip: { x: 0, y: 0, width: 393, height: 60 },
    });

    // qa-iphone15-safe-area-bottom.png
    await page.screenshot({
      path: screenshotPath("qa-iphone15-safe-area-bottom.png"),
      clip: { x: 0, y: 852 - 60, width: 393, height: 60 },
    });

    // I) Back to conversations
    // Chat-first mobile no longer has an index/detail back button; opening the drawer is the supported way.
    await page.getByTestId("conversations-drawer-toggle").click();
    await expect(page.getByTestId("conversations-drawer")).toBeVisible();
    await expect(page.getByText("Conversations")).toBeVisible();
    console.log("PASS: Flow I - Drawer Opened");
  });
});
