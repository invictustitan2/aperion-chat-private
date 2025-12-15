# 🛡️ Aperion Product Reliability & Testing Plan

This document outlines the single source of truth for achieving product reliability and functionality end-to-end for the **Aperion Chat** project.

## 🎯 Objectives

1.  **Zero Critical Bugs** in production paths (Chat, Memory, Identity).
2.  **Full Verification** capability locally before deploy.
3.  **Developer Experience** that makes testing easier than skipping it.

## 🧩 Testing Architecture

### 1. Unit & Logic Tests (Vitest)

- **Scope**: Shared packages (`@aperion/shared`, `@aperion/policy`), heavily used util libraries.
- **Tool**: `vitest`
- **Location**: `packages/*/test` or `src/**/*.test.ts`
- **Command**: `pnpm test` (runs all unit tests in monorepo)

### 2. Service Integration Tests (Wrangler + Vitest)

- **Scope**: `apps/api-worker` endpoints.
- **Tool**: `vitest` + `wrangler.unstable_dev`
- **Strategy**: Spin up a local Worker environment (Miniflare), intercept requests, verify DB state in `aperion-memory`.
- **Command**: `pnpm --filter @aperion/api-worker test`

### 3. End-to-End (E2E) Tests (Playwright)

- **Scope**: `apps/web` UI flows + Real/Mocked Backend.
- **Tool**: `playwright`
- **Strategy**:
  - Launch Web App (Vite).
  - Launch API Worker (Wrangler).
  - Automate browser interaction (Clicking, Typing).
  - Assert visual state and network calls.
- **Command**: `pnpm test:e2e`

## 🛠️ The "Dev Shell" 2.0

We are upgrading the `dev-shell.sh` to be the command center for reliability.

### New Capabilities

- **`verify`**: Runs the full "Ship It" checklist (Lint -> Build -> Unit -> E2E).
- **`logs`**: Tails remote or local worker logs.
- **`db:reset`**: Wipes specific D1 tables for fresh testing.
- **`test:watch`**: Runs tests in watch mode for TDD.

## ✅ Verification Checklist (The "Ship It" Standard)

Before merging or deploying, the following **MUST** pass:

1.  **Health Check**: `./scripts/healthcheck.sh` (Deps, Environment)
2.  **Lint/Format**: `pnpm lint && pnpm format`
3.  **Type Check**: `pnpm typecheck`
4.  **Unit/Integration**: `pnpm test`
5.  **E2E Smoke**: `pnpm test:e2e` (at least critical flows)

## 📋 Implementation Tasks

### Phase 1: Foundation (Current)

- [x] Create centralized dev logs (Completed).
- [x] Basic API integration tests (Completed).
- [x] Upgrade `dev-shell.sh` with new aliases.
- [x] Consolidate Playwright config.

### Phase 2: Coverage Expansion

- [x] **Web**: Add E2E test for "Chat Flow" (User types -> Message appears -> Reply generated).
- [x] **Web**: Add E2E test for "Memory View" (Episodic log renders).
- [x] **API**: Add `policy` package unit tests.

### Phase 3: CI/CD Automation

- [x] GitHub Actions workflow for `verify` on PR.
- [x] Automatic Preview Deployments (Cloudflare).

## 🛑 Failure Handling

- **API Errors**: Check `apps/web/src/pages/Errors.tsx` (The Debug Console).
- **Worker Crash**: Use `wrangler tail` or look at `dev_logs` table.
- **UI Glitch**: Check Browser Console + Playwright Traces.
