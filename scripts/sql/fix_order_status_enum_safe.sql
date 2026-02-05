-- =============================================
-- 🛠 FIX: Order Status Enum Values (Safe Mode)
-- =============================================
-- The previous error "unsafe use of new value" happened because we tried to 
-- SELECT/read the enum values in the same transaction block where we added them.
-- This script ONLY adds the values. 
--
-- PLEASE RUN THIS SCRIPT IN SUPABASE SQL EDITOR.
-- If it still fails, try running each line individually.

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
