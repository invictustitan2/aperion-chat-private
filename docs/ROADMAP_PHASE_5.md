# Aperion Chat — Consolidated Phase 5 Roadmap (Legacy snapshot)

> **Status:** Legacy
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Dev
> \
> **Canonical for:** Historical planning snapshot only

This document is a consolidated planning snapshot and is not maintained as current truth.

For current reality, prefer:

- `docs/PROJECT_STATE.md`
- `docs/DEPLOY_PROD_RUN.md`
- `docs/API_REFERENCE.md`

> **Purpose**: Consolidate existing roadmaps into one plan snapshot, showing what was believed to be **Implemented**, **Partial**, **Not Started**, and **Deferred/External** across the project.
>
> **Source docs merged**:
>
> - Phase 2: [docs/ROADMAP_PHASE_2.md](ROADMAP_PHASE_2.md)
> - Phase 3: [docs/ROADMAP_PHASE_3.md](ROADMAP_PHASE_3.md)
> - Transformational v2.0: [docs/TRANSFORMATIONAL_ROADMAP.md](TRANSFORMATIONAL_ROADMAP.md)
> - Testing: [docs/TESTING_ROADMAP.md](TESTING_ROADMAP.md)
>
> **Status Legend**
>
> - ✅ **Implemented**: Present in repo and operational end-to-end (UI + API + schema/tests as applicable)
> - 🟡 **Partial**: Some code exists, but missing critical UX/API pieces or only stubbed
> - ⬜ **Not Started**: No meaningful implementation found
> - 💤 **Deferred/External**: Intentionally deferred due to external setup (Cloudflare dashboard config, VAPID keys, CI env, etc.)
>
> **Notes on rigor**: Statuses are primarily grounded in codebase signals (routes, controllers/services, migrations, UI pages, tests). Items that are inherently “manual/ops” are marked Deferred/External when the source roadmap labels them as such.

---

## Executive Summary

Aperion Chat has a strong “core platform” foundation (Transformational upgrades largely delivered), plus meaningful Phase 2/3 product features implemented: streaming chat, rich rendering (GFM + KaTeX + Mermaid + Prism), conversations, preferences, analytics, knowledge, insights, relationships (directional “reason receipts”), and a growing testing baseline.

Phase 5 focuses on completing the **remaining Phase 3 intelligence/product work** (knowledge base, insights, memory graph/timeline, contextual memory injection), plus finishing **ops/security deferred items** that require external configuration.

---

## Master Status Table (High-Level)

| Area                                             | Implemented | Partial | Not Started | Deferred/External |
| ------------------------------------------------ | ----------: | ------: | ----------: | ----------------: |
| Core UX (Chat/Navigation/Polish)                 |          11 |       0 |           4 |                 0 |
| Real-time (WebSocket/Presence/Notifications)     |           2 |       1 |           0 |                 3 |
| Memory (Storage/Schema/UX)                       |           6 |       2 |          10 |                 0 |
| AI Features (RAG/Multi-modal/Personas/Proactive) |           5 |       0 |          12 |                 3 |
| Ops/Observability/Runbooks                       |           6 |       0 |           0 |                 4 |
| Security                                         |           3 |       0 |           0 |                 5 |
| Testing/Quality                                  |          12 |       0 |           1 |                 1 |

> Counts are “roadmap items” (not PRs). Some items span multiple subsystems.

---

## 1) Core UX (Chat, Rendering, Navigation)

### Summary

| Item                                    | Status | Notes                                               | Source                       |
| --------------------------------------- | ------ | --------------------------------------------------- | ---------------------------- |
| Streaming AI responses (SSE)            | ✅     | `/v1/chat/stream` exists; UI renders streaming      | Phase 2 (1.1)                |
| Route-based code splitting + lazy pages | ✅     | `React.lazy` + `Suspense` in App                    | Phase 2 (1.2)                |
| Global error boundary                   | ✅     | `ErrorBoundary` wraps app                           | Phase 2 (4.1)                |
| Keyboard shortcuts                      | ✅     | `useKeyboardShortcuts` + command palette toggle     | Phase 2 (5.2), Phase 3 (4.4) |
| Command palette (Cmd/Ctrl+K)            | ✅     | `CommandPalette` and deep link into memory search   | Phase 3 (4.4)                |
| Chat reactions (thumbs up/down)         | ✅     | UI supports rating AI messages                      | Phase 3 (3.1)                |
| User message editing                    | ✅     | Edit UI + update flow present                       | Phase 3 (3.1)                |
| Copy-to-clipboard                       | ✅     | UI supports copy action                             | Phase 3 (3.1)                |
| Share message/conversation              | ✅     | Share flow present (per roadmap claim)              | Phase 3 (3.1)                |
| Rich Markdown (GFM)                     | ✅     | `react-markdown` + `remark-gfm` in `MessageContent` | Phase 3 (3.2)                |
| KaTeX rendering                         | ✅     | `remark-math` + `rehype-katex`                      | Phase 3 (3.2)                |
| Mermaid diagrams                        | ✅     | Mermaid dynamic import renderer                     | Phase 3 (3.2)                |
| Collapsible/expandable code blocks      | ✅     | Prism highlight + collapse/expand                   | Phase 3 (3.1/3.2)            |
| Mobile swipe gestures                   | ⬜     | Roadmap item exists; not validated here             | Phase 3 (3.4)                |
| Pull-to-refresh                         | ⬜     | Not found                                           | Phase 3 (3.4)                |
| Touch target optimization               | ⬜     | Not found as explicit work item                     | Phase 3 (3.4)                |
| Bottom sheets for actions               | ⬜     | Not found                                           | Phase 3 (3.4)                |

---

## 2) Real-time (WebSocket, Presence, Push)

### Summary

| Item                               | Status | Notes                                                            | Source                           |
| ---------------------------------- | ------ | ---------------------------------------------------------------- | -------------------------------- |
| WebSocket client integration       | ✅     | Client exists + hook used in Chat                                | Phase 2 (2.1)                    |
| Typing indicator                   | ✅     | `ChatState` broadcasts typing; UI renders                        | Phase 2 (2.1)                    |
| Presence status                    | 🟡     | Client type includes `presence`, but DO does not handle presence | Phase 2 (2.1)                    |
| Push notifications (Web Push API)  | 💤     | Deferred (VAPID keys)                                            | Phase 2 (2.2)                    |
| Notification preferences UI        | 💤     | Deferred                                                         | Phase 2 (2.2), Phase 3 (5.4/2.2) |
| Backend triggers for notifications | 💤     | Deferred                                                         | Phase 2 (2.2)                    |

---

## 3) Memory (Architecture, Schema, UI)

### 3.1 Memory schema & platform

| Item                                    | Status | Notes                                                   | Source                         |
| --------------------------------------- | ------ | ------------------------------------------------------- | ------------------------------ |
| Tags column for episodic/semantic       | ✅     | Migration exists; API/UI supports episodic tags         | Phase 3 (1.3)                  |
| Importance column for episodic/semantic | ✅     | Migration exists; episodic API exposes/supports updates | Phase 3 (1.2)                  |
| Conversations table + conversation_id   | ✅     | Migration exists + API routes + UI wiring exists        | Phase 3 (2.1)                  |
| Preferences table                       | ✅     | Migration exists + `/v1/preferences/:key` routes        | Phase 3 (2.2)                  |
| Jobs table                              | ✅     | Migration exists; summarization queues/jobs present     | Testing Roadmap, Phase 3 notes |
| Index optimization for D1               | ✅     | Migration `0005_performance_indexes.sql` exists         | Phase 2 (1.3)                  |

### 3.2 Memory UX / features

| Item                                    | Status | Notes                                                                         | Source        |
| --------------------------------------- | ------ | ----------------------------------------------------------------------------- | ------------- |
| Tag management UI                       | ✅     | Implemented in Memory page                                                    | Phase 3 (1.3) |
| Tag-based filtering/search              | ✅     | Implemented for episodic list UI                                              | Phase 3 (1.3) |
| Auto-suggest tags                       | ⬜     | Not found                                                                     | Phase 3 (1.3) |
| Related memories feature                | ✅     | Implemented via Relationships panel on semantic memories                      | Phase 3 (1.1) |
| Relationships table (memory graph)      | ✅     | Directional, provenance-preserving “reason receipts” (not similarity edges)   | Phase 3 (1.1) |
| Memory graph visualization              | ⬜     | Not found                                                                     | Phase 3 (1.1) |
| Automatic relationship detection via AI | ⬜     | Not found                                                                     | Phase 3 (1.1) |
| Memory timeline view                    | ⬜     | Not found                                                                     | Phase 3 (1.4) |
| Date range picker                       | ⬜     | Not found                                                                     | Phase 3 (1.4) |
| “On this day”                           | ⬜     | Not found                                                                     | Phase 3 (1.4) |
| Importance decay algorithm              | ⬜     | Not found                                                                     | Phase 3 (1.2) |
| Pin important memories                  | ⬜     | Not found                                                                     | Phase 3 (1.2) |
| Surface high-importance in chat context | ⬜     | Not found as an explicit selection algorithm                                  | Phase 3 (1.2) |
| Bulk memory actions (delete/tag/export) | ⬜     | Not found                                                                     | Phase 3 (5.2) |
| Memory merging for duplicates           | ⬜     | Not found                                                                     | Phase 3 (5.2) |
| Memory provenance/source display        | 🟡     | Provenance exists in data model; not clearly shown in UI for all memory types | Phase 3 (5.2) |
| Memory edit functionality               | 🟡     | Episodic edits exist (guarded); full memory edit UX not confirmed             | Phase 3 (5.2) |
| Memory comparison view                  | ⬜     | Not found                                                                     | Phase 3 (5.2) |

---

## 4) AI Features (RAG, Multimodal, Personas, Proactive)

### Summary

| Item                                              | Status | Notes                                                        | Source                |
| ------------------------------------------------- | ------ | ------------------------------------------------------------ | --------------------- |
| Multi-modal inputs (image analysis support)       | ✅     | Chat UI supports image upload; backend supports analyze flow | Phase 2 (3.1)         |
| Hybrid search (keyword + semantic)                | ✅     | `SemanticService.hybridSearch` exists + route                | Phase 2 (3.2)         |
| Re-ranking                                        | ✅     | Hybrid merges scores and sorts; lightweight rerank strategy  | Phase 2 (3.2)         |
| Document upload (PDF/TXT) with chunking/embedding | 💤     | Deferred by roadmap                                          | Phase 2 (3.2)         |
| Voice mode enhancements (continuous loop)         | 💤     | Deferred                                                     | Phase 2 (3.3)         |
| VAD                                               | 💤     | Deferred                                                     | Phase 2 (3.3)         |
| Contextual memory injection (smart selection)     | ⬜     | Not found as feature-complete selection/citations            | Phase 3 (6.1)         |
| Relevance scoring for memory retrieval            | ⬜     | Not found as end-to-end user feature                         | Phase 3 (6.1)         |
| Memory citations in responses                     | ⬜     | Not found                                                    | Phase 3 (6.1)         |
| Show which memories influenced response           | ⬜     | Not found                                                    | Phase 3 (6.1)         |
| AI personas system                                | ✅     | Tone preference storage + selector exist (baseline)          | Phase 3 (6.2/5.1/2.2) |
| Persona switching in settings                     | ⬜     | Not found as full persona system UI                          | Phase 3 (6.2)         |
| Custom system prompts                             | ⬜     | Not found                                                    | Phase 3 (6.2)         |
| Persona per conversation                          | ⬜     | Not found                                                    | Phase 3 (6.2)         |
| Suggested questions                               | ⬜     | Not found                                                    | Phase 3 (6.3)         |
| Related topics suggestions                        | ⬜     | Not found                                                    | Phase 3 (6.3)         |
| Memory organization suggestions                   | ⬜     | Not found                                                    | Phase 3 (6.3)         |
| Periodic insight notifications                    | ⬜     | Not found                                                    | Phase 3 (6.3)         |

---

## 5) New Tabs / Product Surfaces

### Summary

| Item                                   | Status | Notes                                                  | Source        |
| -------------------------------------- | ------ | ------------------------------------------------------ | ------------- |
| Analytics dashboard tab                | ✅     | `/analytics` route + API endpoint                      | Phase 3 (4.1) |
| Knowledge base tab                     | ✅     | `/knowledge` route + API endpoints                     | Phase 3 (4.2) |
| Promote semantic memories to knowledge | ✅     | Promote flow exists (semantic → knowledge)             | Phase 3 (4.2) |
| Knowledge categorization/search/export | 🟡     | Categorization/search exist; export not implemented    | Phase 3 (4.2) |
| Insights tab                           | ✅     | `/insights` route + summarize flow                     | Phase 3 (4.3) |
| Periodic memory summaries              | ✅     | Summaries are generated via insights + jobs polling UX | Phase 3 (4.3) |
| Memory digest feature                  | ⬜     | Not found                                              | Phase 3 (4.3) |

---

## 6) Ops, Observability, Reliability

### Summary

| Item                                   | Status | Notes                               | Source                     |
| -------------------------------------- | ------ | ----------------------------------- | -------------------------- |
| Structured logging + trace correlation | ✅     | Logger + request context middleware | Transformational (5)       |
| Metrics via Analytics Engine           | ✅     | Metrics wrapper present             | Transformational (5)       |
| Simple log viewer UI                   | ✅     | Logs route/page exists              | Phase 2 (4.2)              |
| Automated healthcheck script           | ✅     | `scripts/healthcheck.sh` exists     | Phase 2 (4.3), Testing (4) |
| Log streaming (Logpush/Datadog/etc.)   | 💤     | Deferred (external service setup)   | Phase 2 (4.2)              |
| Uptime monitoring                      | 💤     | Deferred                            | Phase 2 (4.3)              |
| D1 automated backups                   | 💤     | Deferred                            | Phase 2 (4.4)              |
| Disaster recovery runbook              | 💤     | Deferred                            | Phase 2 (4.4)              |

---

## 7) Security

### Summary

| Item                           | Status | Notes                                     | Source                              |
| ------------------------------ | ------ | ----------------------------------------- | ----------------------------------- |
| Auth hardening middleware      | ✅     | `withAuth` + strict routing               | Transformational (6)                |
| Input validation schemas       | ✅     | Zod schemas used broadly                  | Transformational (6), Phase 2 (4.1) |
| Rate limiting                  | ✅     | Roadmap claims done; not re-verified here | Phase 2 (6.1)                       |
| JWT refresh/session management | 💤     | Deferred                                  | Phase 2 (6.2)                       |
| Session expiry/forced logout   | 💤     | Deferred                                  | Phase 2 (6.2)                       |
| CSP headers                    | 💤     | Deferred                                  | Phase 2 (6.3)                       |
| Third-party script hardening   | 💤     | Deferred                                  | Phase 2 (6.3)                       |
| Screen reader testing          | 💤     | Deferred/manual QA                        | Phase 2 (5.3)                       |

---

## 8) Testing & Quality

### Summary

| Item                             | Status | Notes                                                    | Source                          |
| -------------------------------- | ------ | -------------------------------------------------------- | ------------------------------- |
| Controller unit test suite       | ✅     | `apps/api-worker/test/controllers/*` exists              | Testing Roadmap (Phase 1)       |
| Auth integration test fixed      | ✅     | `auth.test.ts` exists; local migration path implied      | Testing Roadmap (Phase 2)       |
| Context middleware test          | ✅     | `apps/api-worker/test/middleware/context.test.ts` exists | Testing Roadmap (Phase 2)       |
| Playwright E2E baseline          | ✅     | `apps/web/test/e2e/*` exists                             | Testing Roadmap (Phase 3)       |
| Mobile viewport E2E (iPhone-ish) | ✅     | `chat.spec.ts` sets iPhone 15-ish viewport               | Testing Roadmap (Phase 3)       |
| WebSocket E2E spec               | 💤     | Deferred in testing roadmap                              | Testing Roadmap (Phase 3)       |
| Visual regression testing        | ⬜     | Not found                                                | Testing Roadmap (Coverage gaps) |

---

## Phase 5 Proposed Work (Ordered)

> This is the _consolidated next plan_ based on what’s missing across the merged roadmaps.

### P0 — Intelligence Completion (User-visible value)

1. Knowledge Base tab (`/knowledge`) with promote-from-semantic and browse/search.
2. Insights tab (`/insights`) to surface summaries/digests and recurring themes.
3. Contextual memory injection with explicit citations and “influenced by” UI.

### P1 — Memory Architecture Upgrades

1. Relationships table + “related memories” UI.
2. Memory timeline view with date range.
3. Importance decay + pinning.

#### P1.1 Relationship model (epistemic, directional, provenance-preserving)

**Definition**

A _relationship_ is an explicit statement about how one memory **constrains, explains, depends on, or transforms** another **over time**.

If removing a relationship would not change reasoning (retrieval, ranking, summarization, or policy behavior), it does not belong in the graph.

**Non-negotiables**

- **Directional**: every relationship has a `from` and a `to`. Undirected edges are disallowed.
- **Evidence-first**: episodic events are the ground truth; semantic beliefs are earned abstractions.
- **Receipts**: relationships must preserve provenance (what observations justify what beliefs).
- **No “similarity edges”**: embeddings already handle “relatedness”; the graph is for judgment.

**Three memory layers (current + emerging)**

- **Episodic**: timestamped events (“this happened”).
- **Semantic**: stable abstractions (“this is true, for now”).
- **Procedural/Policy (emerging)**: constraints for how decisions are made (“this is how we act”).

Relationships are the _bridges_ between these layers.

**Minimal relationship types (start here, avoid a taxonomy explosion)**

1. **Episodic → Semantic** (learning)

- `EVIDENCE_FOR`: observed event justifies a belief.
- This is the foundational edge type; it makes semantic memory non-magical and rollback-able.

2. **Semantic → Episodic** (interpretation)

- `INTERPRETS`: an existing belief constrains how an event should be understood/classified.
- Prevents misclassification and “bad explanations” that look like gaslighting.

3. **Semantic → Semantic** (rare, typed, explicit)

- `REFINES`: a belief narrows/clarifies another without contradicting it.
- `CONFLICTS_WITH`: beliefs cannot both be true in the same scope.
- `SUPERSEDES`: new belief replaces old belief (keep old for auditability).

**What relationships are _not_**

- Similarity/co-occurrence/time adjacency.
- Auto-generated “concept webs” that pretend to be reasoning.
- Vague `RELATED_TO` edges.

**Schema shape (implementation guidance)**

At minimum, store:

- `from_kind`, `from_id` (episodic | semantic | policy)
- `to_kind`, `to_id` (episodic | semantic | policy)
- `type` (from the minimal set above)
- `created_at`, `created_by` (system/user), optional `confidence`
- `rationale` (short text: “why this edge exists”)
- optional `evidence` (JSON array of episodic IDs) for semantic↔semantic edges

**Operational invariants (to enforce in code + UI)**

- Semantic beliefs shown as “trusted” should be traceable to at least one `EVIDENCE_FOR` edge (except explicitly seeded system/policy beliefs).
- When summarizing or injecting memories into chat, prefer semantic nodes with strong/consistent evidence trails and include citations via `EVIDENCE_FOR` edges.
- Conflicts must be representable (`CONFLICTS_WITH`) and visible to the system (so we do not pretend mutually exclusive beliefs are simultaneously true).

### P2 — Real-time & Ops Deferred Closures

1. Presence model end-to-end (DO + client + UI).
2. Push notification infrastructure (VAPID) + preferences.
3. CSP and session lifecycle work (if needed for broader deployment).

---

## Appendix: Deferred from earlier phases (External/Manual)

| Item                        | Reason                                |
| --------------------------- | ------------------------------------- |
| Push notifications          | VAPID key + browser permissions       |
| Document uploads (PDF/TXT)  | Complex chunking + embedding workflow |
| Continuous voice mode + VAD | Browser API work                      |
| External log streaming      | External service + Cloudflare config  |
| Uptime monitoring           | External service                      |
| D1 backups                  | Cloudflare dashboard setup            |
| Session management/JWT      | Infrastructure setup                  |
| CSP                         | CF Pages/edge config                  |
| Screen reader testing       | Manual QA                             |
