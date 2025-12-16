-- Migration number: 0003 	 2024-04-20T00:00:00.000Z

-- Add preference columns to identity table
-- We use a specific key (e.g., 'user_preferences') to store these,
-- but adding columns allows for structured query/indexing if needed.
-- Since the table is KV, these will be nullable.

ALTER TABLE identity ADD COLUMN preferred_tone TEXT;
ALTER TABLE identity ADD COLUMN memory_retention_days INTEGER;
ALTER TABLE identity ADD COLUMN interface_theme TEXT;
