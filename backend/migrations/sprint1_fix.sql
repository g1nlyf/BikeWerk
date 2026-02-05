-- Migration: Sprint 1 Fixes based on Actual Schema
-- Description: Aligns new features with the existing readable-ID schema.

-- 1. Customers Enhancements
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'telegram_id') THEN
        ALTER TABLE customers ADD COLUMN telegram_id text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'customers' AND column_name = 'metadata') THEN
        ALTER TABLE customers ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Leads Enhancements
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'intent_score') THEN
        ALTER TABLE leads ADD COLUMN intent_score numeric DEFAULT 0.5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'bike_id') THEN
        ALTER TABLE leads ADD COLUMN bike_id text;
    END IF;
END $$;

-- 3. Orders Enhancements
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reservation_expires_at') THEN
        ALTER TABLE orders ADD COLUMN reservation_expires_at timestamp with time zone;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'urgency_level') THEN
        ALTER TABLE orders ADD COLUMN urgency_level text DEFAULT 'normal';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'manager_telegram_id') THEN
        ALTER TABLE orders ADD COLUMN manager_telegram_id text;
    END IF;
END $$;

-- 4. Tasks Compatibility
-- The existing tasks table has order_id as UUID, but orders.id is TEXT.
-- We add order_readable_id to link correctly to orders(id).
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'order_readable_id') THEN
        ALTER TABLE tasks ADD COLUMN order_readable_id text REFERENCES orders(id);
    END IF;
    -- Add type column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'type') THEN
        ALTER TABLE tasks ADD COLUMN type text DEFAULT 'manual';
    END IF;
END $$;

-- 5. Manager Bot Subscribers (New Table)
CREATE TABLE IF NOT EXISTS manager_subscribers (
    telegram_id text PRIMARY KEY,
    username text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Enable RLS for new table
ALTER TABLE manager_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service Role Full Access Subscribers" ON manager_subscribers FOR ALL USING (auth.role() = 'service_role');
