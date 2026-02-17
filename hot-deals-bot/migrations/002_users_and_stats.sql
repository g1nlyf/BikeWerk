-- Migration 002: Users and Statistics tables

-- Users table for role management
CREATE TABLE IF NOT EXISTS users (
    chat_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    role TEXT DEFAULT 'pending' CHECK (role IN ('pending', 'manager', 'guest', 'admin')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_active DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Processing queue for bulk uploads
CREATE TABLE IF NOT EXISTS processing_queue (
    id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
    url TEXT NOT NULL,
    source TEXT NOT NULL,
    user_chat_id INTEGER NOT NULL,
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
    stolen_bike_id TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME,
    FOREIGN KEY (user_chat_id) REFERENCES users(chat_id)
);

-- Statistics table for tracking views and actions
CREATE TABLE IF NOT EXISTS bot_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL, -- 'view_hot', 'upload_start', 'upload_success', 'upload_fail'
    user_chat_id INTEGER,
    metadata TEXT, -- JSON string with additional data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_queue_user ON processing_queue(user_chat_id);
CREATE INDEX IF NOT EXISTS idx_stats_event ON bot_stats(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_stats_user ON bot_stats(user_chat_id);
