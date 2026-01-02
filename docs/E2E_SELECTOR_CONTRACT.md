# Playwright E2E Selector Contract (Strict-Mode Safe)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev
> \
> **Canonical for:** How E2E tests select elements (strict-mode safe)

This document defines **how we write selectors in Playwright E2E tests** for Aperion Chat.

Goal: keep E2E tests **strict-mode safe**, readable, and resilient to UI refactors.

Scope:

- Web E2E specs under `apps/web/test/e2e/`
- UI components that expose stable test hooks (primarily `data-testid`)

## Why this exists

Playwright’s locator model is intentionally strict:

- Locators are **lazy**: they evaluate at action/assertion time.
- Strict mode requires that a locator used for `click()`/`fill()`/etc resolves to **exactly one element**.

Common failure mode:

- A “row” component contains **multiple actions** (e.g., open/select + rename + delete).
- A test uses `row.getByRole('button')` or `getByText(title).click()`.
- Result: strict mode violation, or the test clicks the wrong action.

We also avoid brittle styling assertions:

- Utility classes (Tailwind) can move between wrapper elements.
- A selector like `.locator('.backdrop-blur-sm')` is brittle and often wrong (descendant vs same element).

## Non‑negotiables

### 1) Never click “any button” inside a composite row

Forbidden patterns (strict-mode traps):

```ts
await row.getByRole("button").click();
await row.locator("button").first().click();
await page.getByText("New Chat").click();
```

Why: a conversation row includes multiple buttons:

- Open/select
- Rename
- Delete

### 2) Prefer accessibility selectors when unique

Good (when unique):

```ts
await page.getByRole("button", { name: "Export PDF" }).click();
await expect(
  page.getByRole("heading", { name: "Operator Chat" }),
).toBeVisible();
```

Rule of thumb:

- `getByRole` is preferred for **single-purpose** UI controls.
- If a region contains multiple controls of the same role, do **not** fall back to a generic role query.

### 3) Prefer `data-testid` for composite widgets

For composite widgets, use dedicated testids. The UI owns the “testing contract”; tests should not infer structure.

## Standard testids

The following testids are implemented in the UI and used by Playwright specs.

### Conversation rows

Component: `apps/web/src/components/ConversationItem.tsx`

Contract:

- Row container: `data-testid="conversation-item"`
- Primary open/select button: `data-testid="conversation-item-open"`
- Actions menu trigger: `data-testid="conversation-actions-trigger"`
- Actions menu items:
  - Rename: `data-testid="conversation-action-rename"`
  - Delete: `data-testid="conversation-action-delete"`

Recommended test patterns:

```ts
const row = page.getByTestId("conversation-item").first();
await expect(row).toBeVisible();
await row.getByTestId("conversation-item-open").click();
```

If you need rename/delete coverage in E2E:

Use the dropdown menu testids, scoped to the row:

```ts
const row = page.getByTestId("conversation-item").first();
await row.getByTestId("conversation-actions-trigger").click();
await page.getByTestId("conversation-action-rename").click();
```

### Conversations drawer (mobile / small screens)

Component: `apps/web/src/pages/Chat.tsx`

Contract:

- Drawer toggle: `data-testid="conversations-drawer-toggle"`
- Drawer container: `data-testid="conversations-drawer"`
- New conversation button: `data-testid="new-conversation"`

Recommended test pattern:

```ts
await page.getByTestId("conversations-drawer-toggle").click();
const drawer = page.getByTestId("conversations-drawer");
await expect(drawer).toBeVisible();

await drawer.getByTestId("new-conversation").click();
```

### Operator panel (desktop + mobile sheet)

Component: `apps/web/src/pages/Chat.tsx`

Contract:

- Operator toggle: `data-testid="operator-panel-toggle"`
- Operator container (desktop aside OR mobile sheet): `data-testid="operator-panel"`
- Cancel streaming: `data-testid="stream-cancel"`

Recommended test patterns:

```ts
await page.getByTestId("operator-panel-toggle").click();
await expect(page.getByTestId("operator-panel")).toBeVisible();

// If streaming is active
const cancel = page.getByTestId("stream-cancel");
if (await cancel.isVisible()) await cancel.click();
```

### Message bubbles

Component: `apps/web/src/components/MessageBubble.tsx`

Contract:

- Bubble wrapper: `data-testid="message-bubble"`
- Bubble content: `data-testid="message-bubble-content"`
- Bubble has `data-message-id` for stable lookup.
- Actions menu trigger: `data-testid="message-actions-trigger"`
- Actions menu items (when enabled by props):
  - `data-testid="message-action-share"`
  - `data-testid="message-action-copy"`
  - `data-testid="message-action-edit"`
  - `data-testid="message-action-rate-up"`
  - `data-testid="message-action-rate-down"`

Example:

```ts
const bubble = page.locator(
  '[data-testid="message-bubble"][data-message-id="epi-1"]',
);
await expect(bubble).toBeVisible();

const bubbleContent = bubble.getByTestId("message-bubble-content");
await expect(bubbleContent).toBeVisible();
```

## Visual effects: “glass” / blur assertions

### Don’t assert Tailwind blur via descendant selectors

Bad:

```ts
// Wrong because it searches *inside* the element for a descendant.
await expect(
  bubble.getByTestId("message-bubble-content").locator(".backdrop-blur-sm"),
).toBeVisible();
```

Reason:

- `.locator('.backdrop-blur-sm')` only matches **descendants**, not the element itself.
- Tailwind utility classes can move between wrapper elements.

### Do assert computed style for effects

Preferred pattern:

```ts
const bubbleContent = bubble.getByTestId("message-bubble-content");
await expect(bubbleContent).toBeVisible();

const backdropFilter = await bubbleContent.evaluate((el) => {
  const style = getComputedStyle(el) as CSSStyleDeclaration & {
    webkitBackdropFilter?: string;
  };
  return style.backdropFilter || style.webkitBackdropFilter || "";
});

// We only assert that blur() is present, not the exact px value.
expect(backdropFilter).toMatch(/blur\(/);
```

Notes:

- Some engines expose `-webkit-backdrop-filter` as `webkitBackdropFilter`.
- We assert a **user-visible capability** (“blur is applied”), not an implementation detail.

## How to choose the right selector (decision tree)

1. Can we select it by role+name uniquely?

- Yes → use `getByRole`.
- No → go to (2).

2. Is it part of a composite widget (row/card) with multiple actions?

- Yes → use `data-testid` contract on the composite widget.
- No → go to (3).

3. Is it a visual/styling behavior (blur, opacity, layout)?

- Prefer computed style or stable layout assertions.
- Avoid Tailwind class chaining and DOM-structure assumptions.

## Example strict-mode failure modes

Common failure patterns this contract is designed to prevent:

1. Visual effect assertions that depend on Tailwind class placement or descendant selectors.
2. Composite widgets where a generic role/text selector matches multiple interactive elements.

## Practical debugging tips

- If a click fails with “strict mode violation”, re-check whether your locator is uniquely identifying the intended element.
- If a selector works locally but flakes in CI:
  - ensure it does not depend on animation timing (use `expect(locator).toBeVisible()` / `toBeEnabled()` before clicking)
  - ensure it does not depend on unstable DOM ordering
- Prefer `page.getByTestId(...)` over brittle CSS selectors.

## Running focused E2E tests

Examples:

- Run one test by name:
  - `pnpm -C apps/web exec playwright test test/e2e/chat.spec.ts -g "mobile layout with glassmorphism"`
- Run one spec file:
  - `pnpm -C apps/web exec playwright test test/e2e/mobile-conversations.spec.ts`
