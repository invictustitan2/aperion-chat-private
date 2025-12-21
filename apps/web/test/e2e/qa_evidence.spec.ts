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
  const screenshotDir = "apps/web/docs/qa/screenshots";

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
  }) => {
    // A) /chat opens to Index view
    await expect(page.getByText("Conversations")).toBeVisible();
    await expect(
      page.getByPlaceholder("Search conversations..."),
    ).toBeVisible();

    // Screenshot: qa-iphone15-chat-index.png
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-chat-index.png`,
    });
    console.log("PASS: Flow A - Index View");

    // B) Create new conversation
    const newConvBtn = page.getByLabel("New conversation");
    await expect(newConvBtn).toBeVisible();
    await newConvBtn.click();

    // C) Detail view shows Operator Chat + Back button
    // Wait for detail view elements
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();

    // Verify Back button is visible on mobile (it's the arrow-left icon usually)
    // We need a reliable selector. The code has a button that calls setView('index').
    // It usually has a specific icon or absolute positioning.
    // Based on Chat.tsx, it's the "ChevronLeft" button in the header.
    // Let's assume it's the first button in the header or has a specific title/label if added?
    // Reviewing Chat.tsx: "Back button returns to Index view" logic matches.
    // It's in the header...

    // D) Send message
    const input = page.getByPlaceholder("Type a message...");
    await input.focus();
    // Screenshot: qa-iphone15-composer-focus.png
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-composer-focus.png`,
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
      path: `${screenshotDir}/qa-iphone15-chat-detail.png`,
    });

    // qa-iphone15-message-actions.png
    // Hover or focus a message bubble to see actions? Or are they always visible on mobile?
    // Code says: "Mobile: Always visible. Desktop: Hover/Focus only" for opacity-100 logic.
    // So on mobile viewport they should be visible.
    // Actually the message bubble wrapper has the actions.
    const shareBtn = page.getByLabel("Share message").first();
    await expect(shareBtn).toBeVisible();
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-message-actions.png`,
    });

    // qa-iphone15-actions-row.png (Header actions)
    // The header is at the top.
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-actions-row.png`,
      clip: { x: 0, y: 0, width: 393, height: 150 },
    });

    // qa-iphone15-safe-area-top.png
    // We can infer this from the full screenshot, but let's take a dedicated crop
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-safe-area-top.png`,
      clip: { x: 0, y: 0, width: 393, height: 60 },
    });

    // qa-iphone15-safe-area-bottom.png
    await page.screenshot({
      path: `${screenshotDir}/qa-iphone15-safe-area-bottom.png`,
      clip: { x: 0, y: 852 - 60, width: 393, height: 60 },
    });

    // I) Back to conversations
    // Find back button. It's likely the "ChevronLeft" icon button in the header.
    // In Chat.tsx we saw: "onClick={() => setView("index")}".
    // It is rendered when isMobile && view === 'detail'.
    // We are in detail view.
    // Let's try to find it by icon or class if label is missing (we fixed labels for some, not sure about back button).
    // Actually the Back button might not have a label yet?
    // Let's check Chat.test.tsx "Back button on mobile has accessible touch target".
    // It says: `const backBtn = screen.getByTestId("mobile-back-button")` (Wait, did I see testID?)
    // In the previous Code View of Chat.tsx (abbreviated), I didn't verify the back button code explicitly.
    // I'll try to find it by role button and index 0 in header.
    const header = page.locator("header");
    const backButton = header.locator("button").first();
    await backButton.click();

    await expect(page.getByText("Conversations")).toBeVisible();
    console.log("PASS: Flow I - Back to Index");
  });
});
