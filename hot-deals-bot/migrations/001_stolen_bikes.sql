-- SQLite Migration: Create stolen_bikes table
-- Local database for Hot Deals Bot

CREATE TABLE IF NOT EXISTS stolen_bikes (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    url TEXT NOT NULL UNIQUE,
    source TEXT NOT NULL,
    raw_message TEXT,
    added_by_user_id INTEGER NOT NULL,
    added_by_username TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed INTEGER DEFAULT 0,
    bike_id TEXT,
    error_message TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_stolen_bikes_url ON stolen_bikes(url);
CREATE INDEX IF NOT EXISTS idx_stolen_bikes_status ON stolen_bikes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stolen_bikes_user ON stolen_bikes(added_by_user_id);
CREATE INDEX IF NOT EXISTS idx_stolen_bikes_processed ON stolen_bikes(processed) WHERE processed = 0;
