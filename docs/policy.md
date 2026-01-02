# Policy & Governance

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator + Dev
> \
> **Canonical for:** What policy gates exist and how they behave today

This document describes the policy gates as implemented in `packages/policy` and how they are integrated into the Worker.

Evidence anchors:

- Policy package: `packages/policy/src/*`
- Worker write paths that persist receipts: `apps/api-worker/src/services/*` and `apps/api-worker/src/controllers/VoiceController.ts`
- Receipts API: `apps/api-worker/src/controllers/ReceiptsController.ts` + `apps/api-worker/src/app.ts` (`GET /v1/receipts`)

## Receipt model (implemented)

The policy package defines a minimal receipt type:

- `decision`: `allow` | `deny` | `defer`
- `reasonCodes`: string[]
- `timestamp`: number
- `inputsHash`: string

Evidence: `packages/policy/src/types.ts`.

## MemoryWriteGate (implemented + used)

`MemoryWriteGate` is used by the Worker’s memory write paths and the resulting receipt is persisted to D1 (`receipts` table).

Evidence: `apps/api-worker/src/services/EpisodicService.ts`, `apps/api-worker/src/services/SemanticService.ts`, `apps/api-worker/src/services/IdentityService.ts`.

### Rules

- **Episodic**: always `allow` (`DEFAULT_ALLOW`).
  - Evidence: `packages/policy/src/memory-gate.ts` (`shouldWriteEpisodic`).
- **Semantic**:
  - If `explicit_confirm === true` in the policy context, `allow` with reason `EXPLICIT_CONFIRMATION`.
  - Otherwise:
    - if `confidence < 0.7` → `defer` with `LOW_CONFIDENCE`
    - if `recurrence !== true` → `defer` with `NO_RECURRENCE`
    - if both checks pass → `allow` with reasons `CONFIDENCE_MET`, `RECURRENCE_VERIFIED`
  - Evidence: `packages/policy/src/memory-gate.ts` (`shouldWriteSemantic`).
- **Identity**: requires user confirmation; if `userConfirmation !== true` → `deny` with `MISSING_CONFIRMATION`, else `allow` with `CONFIRMED`.
  - Evidence: `packages/policy/src/memory-gate.ts` (`shouldWriteIdentity`).

### How the Worker supplies policy context

- Semantic: Worker merges `policyContext` from the request body with `explicit_confirm` extracted from `provenance`.
  - Evidence: `apps/api-worker/src/services/SemanticService.ts`.
- Identity: Worker maps the request field `explicit_confirm` to `userConfirmation`.
  - Evidence: `apps/api-worker/src/services/IdentityService.ts`.

### Current behavior on `deny` / `defer`

In the current Worker implementation, semantic `defer` and identity `deny` both result in a non-`allow` receipt being written and an error returned to the caller (HTTP 403).

Evidence:

- `apps/api-worker/src/services/SemanticService.ts` throws on non-`allow` (`Policy denied/deferred`)
- `apps/api-worker/src/controllers/SemanticController.ts` maps `Policy denied` to HTTP 403
- `apps/api-worker/src/services/IdentityService.ts` throws on non-`allow` (`Policy denied`)
- `apps/api-worker/src/controllers/IdentityController.ts` maps `Policy denied` to HTTP 403

## ActionGate (implemented, not currently wired into the Worker)

`ActionGate` exists in `packages/policy` and can deny a small allow-list of destructive actions unless `userConfirmation === true`.

Evidence: `packages/policy/src/action-gate.ts`.

However, there are no in-repo references to `ActionGate` from the Worker at the moment, so this gate is **available but not actively enforced** by the API runtime.
