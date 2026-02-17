
-- Migration 003: Add price and title columns to stolen_bikes
ALTER TABLE stolen_bikes ADD COLUMN title TEXT;
ALTER TABLE stolen_bikes ADD COLUMN price REAL;
ALTER TABLE stolen_bikes ADD COLUMN price_rub REAL;
ALTER TABLE stolen_bikes ADD COLUMN currency TEXT DEFAULT 'EUR';
