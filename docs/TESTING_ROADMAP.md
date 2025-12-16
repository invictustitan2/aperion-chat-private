# Comprehensive Testing & Implementation Roadmap

## 1. Executive Summary

This validation plan aims to achieve 100% critical path coverage across Frontend, Backend (API Worker), and Cloudflare services. It addresses current gaps in Controller unit tests and End-to-End (E2E) verification for the new mobile-first UI.

## 2. Coverage Gaps & Lapses

### Backend (API Worker)

- **Controllers**: `ChatController`, `EpisodicController`, `SemanticController`, `IdentityController`, and `VoiceController` lack dedicated unit tests.
- **Integration**: `auth.test.ts` fails due to unmigrated D1 database in `unstable_dev` environment.
- **Middleware**: `withContext` and `errorHandler` need explicit verification.

### Frontend (Web)

- **Mobile Responsiveness**: Glassmorphism and safe-area insets are implemented but not verifying via visual regression or viewport-specific E2E tests.
- **State Management**: Interaction with the new `ChatState` Durable Object (WebSocket) is manual-only.

## 3. Implementation Plan

### Phase 1: Backend Unit Testing (Immediate)

- [ ] Create `test/controllers/` directory.
- [ ] Implement `ChatController.test.ts`: Verify validation, service delegation, and error mapping.
- [ ] Implement `IdentityController.test.ts`: Mock IdentityService to fix 500 errors in auth tests.
- [ ] Implement `SemanticController.test.ts`: Verify `create` and `search` logic.
- [ ] Implement `EpisodicController.test.ts`.

### Phase 2: Integration & Database

- [ ] Fix `auth.test.ts`:
  - Option A: Seed `unstable_dev` with migrations `d1:migrations:apply`.
  - Option B (Preferred): Mock the Service layer so `auth.test.ts` focuses purely on `withAuth` middleware behavior, independent of DB.
- [ ] Add `middleware.test.ts`: Verify `withContext` injection of Logger/Metrics.

### Phase 3: Frontend E2E (Playwright)

- [ ] Update `chat.spec.ts`:
  - Configure mobile viewports (iPhone 15 dimensions).
  - Verify "Glassmorphism" elements visibility.
- [ ] Add `websocket.spec.ts`: Mock WebSocket events to test real-time typing indicators.

### Phase 4: CI/CD Pipeline

- [ ] Update `healthcheck.sh` to include new test suites.
- [ ] Ensure `Playwright` runs against a preview build or mocked API.

## 4. Execution Order

1. **Fix `auth.test.ts`** (Blocker for CI).
2. **Add Controller Unit Tests** (High Value/Low Cost).
3. **Update E2E Tests** (High Assurance).
