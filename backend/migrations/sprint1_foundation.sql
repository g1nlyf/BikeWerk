-- Migration: Sprint 1 Foundation - Leads & Orders Structure
-- Description: Optimizes Leads/Orders/Customers relationship and adds Magic Link support.

-- 1. Create Leads Table (Intent)
CREATE TABLE IF NOT EXISTS leads (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id uuid REFERENCES customers(id),
    bike_id text, -- Link to local SQLite bike ID
    status text DEFAULT 'new', -- new, converted, lost
    intent_score numeric DEFAULT 0.5, -- AI score of intent
    source text DEFAULT 'website',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb
);

-- 2. Update Orders Table (The Deal)
-- Add lead_id reference
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'lead_id') THEN
        ALTER TABLE orders ADD COLUMN lead_id uuid REFERENCES leads(id);
    END IF;
END $$;

-- Add assigned_manager if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'assigned_manager') THEN
        ALTER TABLE orders ADD COLUMN assigned_manager text; -- Telegram username or ID
    END IF;
END $$;

-- Add reservation_expires_at if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'reservation_expires_at') THEN
        ALTER TABLE orders ADD COLUMN reservation_expires_at timestamp with time zone;
    END IF;
END $$;

-- Add urgency_level if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'urgency_level') THEN
        ALTER TABLE orders ADD COLUMN urgency_level text DEFAULT 'normal';
    END IF;
END $$;

-- 3. Tasks Table (Manager Co-Pilot - Sprint 2 Prep)
CREATE TABLE IF NOT EXISTS tasks (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id uuid REFERENCES orders(id),
    title text NOT NULL,
    description text,
    status text DEFAULT 'pending', -- pending, completed
    type text DEFAULT 'manual', -- manual, ai_generated
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Manager Bot Subscribers
CREATE TABLE IF NOT EXISTS manager_subscribers (
    telegram_id text PRIMARY KEY,
    username text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable RLS (Row Level Security) - Best Practice
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Policies (Open for service role, restricted for others if needed later)
CREATE POLICY "Service Role Full Access Leads" ON leads FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service Role Full Access Tasks" ON tasks FOR ALL USING (auth.role() = 'service_role');
