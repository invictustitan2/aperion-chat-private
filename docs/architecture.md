# Architecture

## Overview

Aperion Chat Private is a single-user, memory-backed chat system designed for privacy and longevity.

## Components

### Apps
- **Web UI (`apps/web`)**: The interface for the user.
- **API Worker (`apps/api-worker`)**: The backend logic running on Cloudflare Workers. Handles request processing and orchestration.

### Packages
- **Memory Core (`packages/memory-core`)**: The heart of the system. Manages episodic, semantic, and identity memory. Enforces provenance.
- **Policy (`packages/policy`)**: The brain's superego. Defines rules for what can be written to memory and what actions can be taken.
- **Shared (`packages/shared`)**: Common types and utilities.

### Tools
- **CLI (`tools/cli`)**: Local operations for data management (seed, migrate, export).

## Invariants

1.  **Memory Immutability**: Once an episodic memory is finalized, it cannot be altered, only appended to or referenced.
2.  **Policy Enforcement**: All memory writes must pass through the Policy layer.
3.  **Headless Operation**: The memory engine and policy layer must function independently of the UI.
