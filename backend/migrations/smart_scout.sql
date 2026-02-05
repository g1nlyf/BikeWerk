-- Smart Scout & AI Concierge Tables

-- Wishlist Snipers: Stores user searches that returned no results (or user explicitly saved)
-- The 'criteria' column stores the JSON structure extracted by Gemini (e.g., {"type":"road", "max_price":2000})
CREATE TABLE IF NOT EXISTS wishlist_snipers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER, -- Optional, can be null for guests with session_id (handled in logic)
    session_id TEXT, -- For guests
    query_text TEXT NOT NULL,
    structured_criteria TEXT, -- JSON
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_checked_at DATETIME,
    matches_found INTEGER DEFAULT 0
);

-- User Swipes: Tinder-like interactions
CREATE TABLE IF NOT EXISTS user_swipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    session_id TEXT,
    bike_id INTEGER NOT NULL,
    action TEXT NOT NULL, -- 'like', 'dislike', 'superlike'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(bike_id) REFERENCES bikes(id)
);

-- Index for fast matching
CREATE INDEX IF NOT EXISTS idx_wishlist_active ON wishlist_snipers(is_active);
CREATE INDEX IF NOT EXISTS idx_swipes_user ON user_swipes(user_id, session_id);
