-- Fix Orders Table Schema for Manager Bot
-- Run this in Supabase SQL Editor
-- Context: Supports both UUID and Human-Readable ID schemas (uses TEXT for flexibility)

-- 1. Add missing columns to 'orders'
-- Note: 'total_price_rub' and 'manager_notes' might be missing if migrations failed
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manager_notes text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS assigned_manager text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price_rub numeric DEFAULT 0;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bike_name text; -- Bot expects this field directly on orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS bike_url text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS final_quality text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS initial_quality text DEFAULT 'A';
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_refundable boolean DEFAULT false;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS negotiated_price_eur numeric;

-- 2. Create 'inspections' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.inspections (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id text, -- Flexible link to orders.id (UUID or ORD-Code) or orders.order_code
    stage text DEFAULT 'remote',
    defects_found jsonb,
    ai_verdict text,
    manager_notes text,
    photos jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Create index on order_id for inspections
CREATE INDEX IF NOT EXISTS idx_inspections_order_id ON public.inspections(order_id);


-- 3. Create 'negotiations' table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.negotiations (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    order_id text, -- Flexible link
    seller_platform text,
    start_price numeric,
    final_price numeric,
    success boolean,
    chat_transcript text,
    seller_contact_info text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
-- Create index on order_id for negotiations
CREATE INDEX IF NOT EXISTS idx_negotiations_order_id ON public.negotiations(order_id);


-- 4. Create 'manager_subscribers' table if it doesn't exist (Legacy/Fallback)
CREATE TABLE IF NOT EXISTS public.manager_subscribers (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    telegram_id bigint UNIQUE NOT NULL,
    username text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Force Schema Cache Reload
NOTIFY pgrst, 'reload schema';
