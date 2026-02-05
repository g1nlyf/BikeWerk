-- Add user preferences table for recommendations
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id INTEGER PRIMARY KEY,
    brands TEXT, -- JSON array of brands e.g. ["Canyon", "Specialized"]
    min_price REAL,
    max_price REAL,
    categories TEXT, -- JSON array e.g. ["MTB", "Road"]
    min_year INTEGER,
    size TEXT, -- e.g. "L" or "56"
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add waitlist table if not exists (for 'My Search')
CREATE TABLE IF NOT EXISTS user_waitlists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    query TEXT, -- Search query or description
    min_price REAL,
    max_price REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
