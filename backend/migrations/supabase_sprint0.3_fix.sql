
-- Sprint 0.3 Fix: Add missing columns for Price Calculator (RUB support)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS total_price_rub NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS booking_amount_rub NUMERIC;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS delivery_method TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Ensure indexes for analytics
CREATE INDEX IF NOT EXISTS idx_orders_total_price_rub ON public.orders(total_price_rub);
