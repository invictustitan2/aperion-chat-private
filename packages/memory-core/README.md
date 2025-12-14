# Memory Core

The `memory-core` package implements the provenance-first memory engine for Aperion Chat.

## Architecture

The memory system is stratified into three layers, each with specific invariants and purposes.

### 1. Episodic Memory (The "Truth")

- **Nature**: Append-only, immutable, time-indexed.
- **Content**: Raw transcripts of interactions, external events, or tool outputs.
- **Invariant**: Once written, a record cannot be changed. It is the ground truth.
- **Storage**: High-durability storage (e.g., D1, SQL).

### 2. Semantic Memory (The "Index")

- **Nature**: Derived, revisable, graph/vector-based.
- **Content**: Summaries, facts, and knowledge extracted from episodic memory.
- **Invariant**: Every semantic record must reference at least one episodic source (provenance).
- **Storage**: Vector database (e.g., Vectorize) + Metadata store.

### 3. Identity Memory (The "Self")

- **Nature**: Sparse, slow-changing, high-stakes.
- **Content**: User preferences, core beliefs, biographical data.
- **Invariant**: Writes require explicit confirmation (gated by policy).
- **Storage**: Key-Value store (e.g., KV) or SQL.

## Provenance

Every memory record includes a `provenance` object detailing:

- `source_type`: user, system, model, external.
- `source_id`: Identifier of the source.
- `timestamp`: When the information originated.
- `confidence`: Reliability score.
- `derived_from`: Links to source records (for semantic/identity).

## Hashing

We use deterministic hashing (SHA-256 of canonicalized JSON) to ensure data integrity and deduplication.
