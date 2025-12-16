-- Migration: Conversation Threads
-- Adds conversations table and conversation_id column on episodic

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    metadata TEXT
);

-- Add conversation_id to episodic table
ALTER TABLE episodic ADD COLUMN conversation_id TEXT;

-- Helpful index for listing messages by conversation
CREATE INDEX IF NOT EXISTS idx_episodic_conversation_created_at
  ON episodic (conversation_id, created_at);

-- Helpful index for listing conversations by updated_at
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at
  ON conversations (updated_at);
