-- Migration: Add bike_url to orders table
-- Run this in Supabase SQL Editor

ALTER TABLE orders ADD COLUMN IF NOT EXISTS bike_url TEXT;

-- Verify if other columns needed for Manager Bot are present
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_manager TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS manager_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS final_quality TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_refundable BOOLEAN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS negotiated_price_eur NUMERIC;
