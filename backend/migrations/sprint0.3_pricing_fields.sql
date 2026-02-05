-- Migration: Add fields for Ruble pricing and delivery method
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_price_rub INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS booking_amount_rub INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT DEFAULT 'Cargo';
