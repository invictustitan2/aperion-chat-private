-- Migration number: 0002 	 2025-12-15T00:00:00.000Z

CREATE TABLE dev_logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    level TEXT NOT NULL,
    message TEXT NOT NULL,
    stack_trace TEXT,
    metadata TEXT,
    source TEXT
);

CREATE INDEX idx_dev_logs_timestamp ON dev_logs(timestamp DESC);
