# Upgrade Philosophy

This document serves as a contract for the evolution of the Aperion Chat Private system.

## Core Tenets

1.  **No placeholder features**: Every feature committed to the codebase must be functional and tested. We do not commit "TODO" implementations that are exposed to the user.
2.  **No silent behavior**: The system must be explicit about its actions, especially regarding memory and policy. Failures should be noisy and actionable.
3.  **Provenance required**: All memory records must have provenance. We must know _why_ a memory exists and _where_ it came from.
4.  **Write gates for memory**: Writing to long-term memory is a privileged action. It must be gated by policy to ensure data quality and user consent (implicit or explicit).
5.  **Always progressive**: We do not remove features to simplify maintenance unless they are replaced by superior equivalents. We build _up_, not _down_.
