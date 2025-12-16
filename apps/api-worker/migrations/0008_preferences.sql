-- Migration: User Preferences
-- Adds a key/value preferences table for user settings.

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_preferences_updated_at ON preferences (updated_at);
