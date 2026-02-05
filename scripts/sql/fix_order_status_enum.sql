-- =============================================
-- 🛠 FIX: Order Status Enum Values
-- Run this in Supabase SQL Editor to fix "invalid input value for enum" errors.
-- =============================================

-- 1. Ensure the type exists (just in case, though error implies it does)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status_enum') THEN
        CREATE TYPE public.order_status_enum AS ENUM ('created');
    END IF;
END$$;

-- 2. Add all required statuses (Safe to run multiple times)
-- We use a transaction block to ensure atomicity where possible, 
-- but ALTER TYPE cannot run inside a transaction block in some Postgres versions 
-- if used with other commands. However, ADD VALUE is usually safe.

ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'awaiting_deposit';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'deposit_paid';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'under_inspection';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'quality_confirmed';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'quality_degraded';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'fully_paid';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'shipped';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'delivered';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE public.order_status_enum ADD VALUE IF NOT EXISTS 'closed';

-- 3. Verify the result
SELECT enum_range(NULL::order_status_enum);
