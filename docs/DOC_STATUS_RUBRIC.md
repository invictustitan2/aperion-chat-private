# Documentation Status Rubric

Use these statuses at the top of docs to make it obvious what is trustworthy and what is historical.

## Status values

### Full (canonical)

- Intended to be followed as-is.
- Kept in sync with repo guardrails/tests.
- If it conflicts with another doc, this one wins.

### Partial

- Useful, but missing steps/details, or known to be stale in parts.
- Must be validated against code/config before relying on it.

### Planned

- Future intent / design notes.
- May not reflect current implementation.

### Untested

- Describes behavior that exists (or is believed to exist) but has no automated verification and no recent operator receipts.

### Legacy

- Historical context, previous contracts, or rollout plans that are no longer the current operating model.
- Kept only for archaeology/rollback references.

## Header template (paste at top of docs)

> **Status:** Full (canonical)
> \
> **Last reviewed:** 2026-01-02
> \
> **Audience:** Operator (solo) | Dev | Both
> \
> **Canonical for:** <what this doc is the source of truth for>
> \
> **Replaces:** <links, if any>
