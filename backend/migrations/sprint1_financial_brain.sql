-- SPRINT 1: THE FINANCIAL BRAIN
-- Migration to add financial breakdown columns to orders table

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS exchange_rate numeric,
ADD COLUMN IF NOT EXISTS shipping_cost_eur numeric,
ADD COLUMN IF NOT EXISTS insurance_cost_eur numeric,
ADD COLUMN IF NOT EXISTS service_fee_eur numeric,
ADD COLUMN IF NOT EXISTS payment_commission_eur numeric,
ADD COLUMN IF NOT EXISTS total_price_rub numeric,
ADD COLUMN IF NOT EXISTS booking_amount_rub numeric,
ADD COLUMN IF NOT EXISTS delivery_method text;
