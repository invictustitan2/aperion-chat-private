-- Migration number: 0005 	 2024-12-16T00:00:00.000Z
-- Add indexes for common query patterns to improve performance

-- Episodic: Frequently queried by created_at for listing
CREATE INDEX IF NOT EXISTS idx_episodic_created_at ON episodic(created_at DESC);

-- Semantic: Frequently queried by created_at and for content search
CREATE INDEX IF NOT EXISTS idx_semantic_created_at ON semantic(created_at DESC);

-- Receipts: Frequently queried by timestamp for audit logs
CREATE INDEX IF NOT EXISTS idx_receipts_timestamp ON receipts(timestamp DESC);

-- Identity: Rarely needs index beyond primary key (key), but adding for last_verified queries
CREATE INDEX IF NOT EXISTS idx_identity_last_verified ON identity(last_verified);
