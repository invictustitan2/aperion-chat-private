-- Migration: Directional Relationships (Evidence-driven)
-- Adds a relationships table for epistemic, directional links between memories.

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL, -- 'user' | 'system'

  type TEXT NOT NULL, -- EVIDENCE_FOR | INTERPRETS | REFINES | CONFLICTS_WITH | SUPERSEDES

  from_kind TEXT NOT NULL, -- episodic | semantic | knowledge | policy
  from_id TEXT NOT NULL,

  to_kind TEXT NOT NULL,
  to_id TEXT NOT NULL,

  rationale TEXT NOT NULL,
  confidence REAL,

  evidence TEXT -- JSON array of IDs (optional)
);

-- Prevent duplicate edges of same meaning.
CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique
  ON relationships (from_kind, from_id, to_kind, to_id, type);

CREATE INDEX IF NOT EXISTS idx_relationships_from
  ON relationships (from_kind, from_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationships_to
  ON relationships (to_kind, to_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relationships_type
  ON relationships (type, created_at DESC);
