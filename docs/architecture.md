# Architecture

## Overview

Aperion Chat Private is a single-user, memory-backed chat system designed for privacy and longevity.

## Components

### Apps

- **Web UI (`apps/web`)**: The interface for the user. Mobile-first design (Glassmorphism).
- **API Worker (`apps/api-worker`)**: The backend logic running on Cloudflare Workers.
  - **Clean Architecture**: Organized into `Controllers` (HTTP handling), `Services` (Business Logic), and `Middleware` (Auth, Logging).
  - **Integrations**:
    - **Workers AI**: On-edge inference (Llama, Whisper, Embeddings).
    - **Durable Objects**: `ChatState` for WebSocket real-time state.
    - **R2**: `aperion-media` bucket for storing voice/image assets.
    - **Queues**: `aperion-memory-queue` for async memory processing.
    - **D1**: `aperion-memory` for structured data (Episodic, Identity).
    - **Vectorize**: `aperion-vectors` for semantic search.

### Packages

- **Memory Core (`packages/memory-core`)**: The heart of the system. Manages episodic, semantic, and identity memory types.
- **Policy (`packages/policy`)**: The brain's superego. Defines strictly enforcing security gates (`MemoryWriteGate`) for all memory operations.
- **Shared (`packages/shared`)**: Common types, utilities, and z-schema definitions.

### Tools

- **CLI (`tools/cli`)**: Local operations for data management (seed, migrate, export).

## Invariants

1.  **Memory Immutability**: Once an episodic memory is finalized, it cannot be altered.
2.  **Policy Enforcement**: All memory writes pass through the `Policy` layer and generate `Receipts`.
3.  **Type Safety**: Strict Zod schemas validate all API inputs.
4.  **Observability**: Every request is traced (`traceId`) and logged with structured context.
