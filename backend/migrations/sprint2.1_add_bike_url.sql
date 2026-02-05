-- Add bike_url to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS bike_url TEXT;
