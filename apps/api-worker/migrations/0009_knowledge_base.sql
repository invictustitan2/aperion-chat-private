-- Migration: Knowledge Base
-- Adds a curated knowledge table derived from semantic memories

CREATE TABLE IF NOT EXISTS knowledge (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  source_semantic_id TEXT,
  tags TEXT DEFAULT '[]',
  metadata TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_source_semantic
  ON knowledge (source_semantic_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_updated_at
  ON knowledge (updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_knowledge_created_at
  ON knowledge (created_at DESC);
