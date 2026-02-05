-- Unify Schema Migration
-- This script adds columns that might be missing in some environments (e.g. fresh mysql-config.js inits)
-- Note: SQLite does not support IF NOT EXISTS for ADD COLUMN. 
-- If running on an existing DB that already has these columns, these statements will fail.
-- Use the validate-schema.js or apply-migration.js script for safe application.

-- Add missing columns to bikes table
ALTER TABLE bikes ADD COLUMN location TEXT;
ALTER TABLE bikes ADD COLUMN size TEXT;
ALTER TABLE bikes ADD COLUMN wheel_diameter TEXT;
ALTER TABLE bikes ADD COLUMN original_url TEXT;
ALTER TABLE bikes ADD COLUMN priority TEXT DEFAULT 'normal';
ALTER TABLE bikes ADD COLUMN hotness_score REAL DEFAULT 0;
ALTER TABLE bikes ADD COLUMN views INTEGER DEFAULT 0;
ALTER TABLE bikes ADD COLUMN last_checked DATETIME;
ALTER TABLE bikes ADD COLUMN deactivation_reason TEXT;
ALTER TABLE bikes ADD COLUMN deactivated_at DATETIME;
ALTER TABLE bikes ADD COLUMN source_url TEXT;
ALTER TABLE bikes ADD COLUMN fmv REAL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_bikes_hotness ON bikes(hotness_score DESC);
-- SQLite index on expression requires newer version or different syntax, assuming standard column index here?
-- "idx_bikes_tier_active" -> tier is in bikes (I should check if tier exists)
-- Audit showed 'tier' exists (index 86).
CREATE INDEX IF NOT EXISTS idx_bikes_tier_active ON bikes(tier, is_active);
CREATE INDEX IF NOT EXISTS idx_bikes_last_checked ON bikes(last_checked);

-- Market history updates
ALTER TABLE market_history ADD COLUMN frame_material TEXT;
ALTER TABLE market_history ADD COLUMN trim_level TEXT;
ALTER TABLE market_history ADD COLUMN quality_score INTEGER DEFAULT 100;
ALTER TABLE market_history ADD COLUMN category TEXT;
ALTER TABLE market_history ADD COLUMN year INTEGER;
ALTER TABLE market_history ADD COLUMN title TEXT;
ALTER TABLE market_history ADD COLUMN frame_size TEXT;
ALTER TABLE market_history ADD COLUMN condition TEXT;

-- New tables
CREATE TABLE IF NOT EXISTS refill_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT NOT NULL,
  model TEXT NOT NULL,
  tier INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME
);

CREATE TABLE IF NOT EXISTS needs_manual_review (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand TEXT,
  model TEXT,
  year INTEGER,
  price INTEGER,
  reason TEXT,
  source_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
