-- Migration number: 0001 	 2024-03-20T00:00:00.000Z

CREATE TABLE episodic (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    content TEXT NOT NULL,
    provenance TEXT NOT NULL, -- JSON
    hash TEXT NOT NULL
);

CREATE TABLE semantic (
    id TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding TEXT, -- JSON array or blob
    "references" TEXT NOT NULL, -- JSON array of UUIDs
    provenance TEXT NOT NULL, -- JSON
    hash TEXT NOT NULL
);

CREATE TABLE identity (
    key TEXT PRIMARY KEY,
    id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    value TEXT NOT NULL, -- JSON
    provenance TEXT NOT NULL, -- JSON
    hash TEXT NOT NULL,
    last_verified INTEGER
);

CREATE TABLE receipts (
    id TEXT PRIMARY KEY,
    timestamp INTEGER NOT NULL,
    decision TEXT NOT NULL,
    reason_codes TEXT NOT NULL, -- JSON
    inputs_hash TEXT NOT NULL
);
