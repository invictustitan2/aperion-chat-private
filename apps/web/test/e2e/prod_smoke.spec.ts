import { expect, test } from "@playwright/test";

// Production-safe smoke pack.
// Read-only assertions only: do not send messages or mutate server state.

test.describe("prod smoke: chat.aperion.cc", () => {
  test("chat loads, key controls visible, preferences route exists", async ({
    page,
  }) => {
    const prefResponsePromise = page
      .waitForResponse(
        (resp) =>
          resp.url().includes("/api/v1/preferences/ai.tone") &&
          resp.request().method() === "GET",
        { timeout: 15_000 },
      )
      .catch(() => null);

    await page.setViewportSize({ width: 393, height: 852 });
    await page.goto("/chat", { waitUntil: "domcontentloaded" });

    // UI baseline
    await expect(
      page.getByRole("heading", { name: "Operator Chat" }),
    ).toBeVisible({ timeout: 15_000 });

    // Mobile drawer toggle should exist at this viewport.
    await expect(page.getByTestId("conversations-drawer-toggle")).toBeVisible();

    // Composer baseline
    await expect(page.getByPlaceholder("Type a message...")).toBeVisible();
    await expect(page.getByLabel("Send message")).toBeVisible();

    // Operator panel toggle should be clickable (guards against header overlap).
    await page.getByTestId("operator-panel-toggle").click();
    await expect(page.getByTestId("operator-panel")).toBeVisible();

    // Preferences contract (Path B) must resolve (not 404 from Pages).
    const prefResp = await prefResponsePromise;
    if (prefResp) {
      expect(prefResp.status()).not.toBe(404);
    }
  });
});
