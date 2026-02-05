-- Enhanced FMV Schema Migration
-- Version: 2.3.0
-- Date: 2026-01-31

-- 1. Create table if it doesn't exist (fresh install)
CREATE TABLE IF NOT EXISTS market_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER,
    category TEXT,
    discipline TEXT,
    price_eur REAL NOT NULL,
    original_price_eur REAL,
    condition_score INTEGER,
    condition_text TEXT,
    is_new INTEGER DEFAULT 0,
    frame_size TEXT,
    frame_material TEXT,
    groupset TEXT,
    suspension_type TEXT,
    wheel_size TEXT,
    source TEXT NOT NULL,
    source_url TEXT NOT NULL UNIQUE,
    listing_title TEXT,
    scraped_at DATETIME NOT NULL,
    listing_created_at DATETIME,
    days_on_market INTEGER DEFAULT 0,
    photo_count INTEGER DEFAULT 0,
    has_description INTEGER DEFAULT 0,
    seller_type TEXT,
    location TEXT,
    country TEXT
);

-- 2. Add columns to existing table (safe add)
-- These will fail if column exists, but our runner handles it.
ALTER TABLE market_history ADD COLUMN year INTEGER;
ALTER TABLE market_history ADD COLUMN category TEXT;
ALTER TABLE market_history ADD COLUMN discipline TEXT;
ALTER TABLE market_history ADD COLUMN original_price_eur REAL;
ALTER TABLE market_history ADD COLUMN condition_score INTEGER;
ALTER TABLE market_history ADD COLUMN condition_text TEXT;
ALTER TABLE market_history ADD COLUMN is_new INTEGER DEFAULT 0;
ALTER TABLE market_history ADD COLUMN frame_material TEXT;
ALTER TABLE market_history ADD COLUMN groupset TEXT;
ALTER TABLE market_history ADD COLUMN suspension_type TEXT;
ALTER TABLE market_history ADD COLUMN listing_created_at DATETIME;
ALTER TABLE market_history ADD COLUMN days_on_market INTEGER DEFAULT 0;
ALTER TABLE market_history ADD COLUMN photo_count INTEGER DEFAULT 0;
ALTER TABLE market_history ADD COLUMN has_description INTEGER DEFAULT 0;
ALTER TABLE market_history ADD COLUMN seller_type TEXT;
ALTER TABLE market_history ADD COLUMN location TEXT;
ALTER TABLE market_history ADD COLUMN country TEXT;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_fmv_brand_model_year ON market_history(brand, model, year);
CREATE INDEX IF NOT EXISTS idx_fmv_category_price ON market_history(category, price_eur);
CREATE INDEX IF NOT EXISTS idx_fmv_scraped_at ON market_history(scraped_at);
CREATE INDEX IF NOT EXISTS idx_fmv_source_url ON market_history(source_url);
