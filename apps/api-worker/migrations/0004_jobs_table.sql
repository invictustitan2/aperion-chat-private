-- Migration number: 0004 	 2024-05-01T00:00:00.000Z

CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'summarize', 'embedding', etc.
    status TEXT NOT NULL, -- 'pending', 'processing', 'completed', 'failed'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    input TEXT, -- JSON payload of input
    output TEXT, -- JSON payload of result
    error TEXT
);

CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_jobs_created_at ON jobs(created_at DESC);
