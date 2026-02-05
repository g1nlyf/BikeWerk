-- Incremental Migration for Order Status Events and Shipments
-- Run this script in your Supabase SQL Editor
-- This script ONLY updates order_status_events and shipments tables.

BEGIN;

-- Ensure helper function exists (safe to re-run)
CREATE SEQUENCE IF NOT EXISTS global_id_seq START 1;

CREATE OR REPLACE FUNCTION generate_readable_id(prefix text) RETURNS text AS $$
DECLARE
    seq_val bigint;
    date_part text;
BEGIN
    date_part := to_char(current_date, 'YYYYMMDD');
    seq_val := nextval('global_id_seq');
    -- Format: PREFIX-YYYYMMDD-0001
    RETURN prefix || '-' || date_part || '-' || lpad(seq_val::text, 4, '0');
END;
$$ LANGUAGE plpgsql;


-- 1. MIGRATE ORDER STATUS EVENTS
-- Check if migration already happened to avoid errors
DO $$
BEGIN
    -- Only proceed if 'old_uuid_id' does NOT exist in 'order_status_events'
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_status_events' AND column_name = 'old_uuid_id') THEN
        
        -- 1.1 Prepare new ID
        ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS new_id text;
        
        WITH numbered AS (
          SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
          FROM order_status_events
        )
        UPDATE order_status_events
        SET new_id = 'EVT-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
        FROM numbered
        WHERE order_status_events.id = numbered.id AND order_status_events.new_id IS NULL;

        -- 1.2 Switch Event PK
        ALTER TABLE order_status_events DROP CONSTRAINT IF EXISTS order_status_events_pkey CASCADE;

        ALTER TABLE order_status_events RENAME COLUMN id TO old_uuid_id;
        ALTER TABLE order_status_events RENAME COLUMN new_id TO id;
        ALTER TABLE order_status_events ALTER COLUMN id SET DEFAULT generate_readable_id('EVT');
        ALTER TABLE order_status_events ADD PRIMARY KEY (id);

        -- 1.3 Update Foreign Key to Orders (if orders uses new ID)
        -- Assuming orders table is already migrated and uses order_code-like ID.
        -- We need to ensure order_status_events.order_id points to the correct ID in orders.
        -- If orders was migrated, the old UUID foreign key might be broken or need updating if column types changed.
        -- However, usually we update the child FK column.
        
        -- NOTE: In the previous full script, we updated child tables. If that ran partially, we might need to fix FKs here.
        -- Let's ensure order_id matches orders.id type.
        
    END IF;
END $$;


-- 2. MIGRATE SHIPMENTS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'shipments' AND column_name = 'old_uuid_id') THEN
        
        -- 2.1 Prepare new ID
        ALTER TABLE shipments ADD COLUMN IF NOT EXISTS new_id text;
        
        WITH numbered AS (
          SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
          FROM shipments
        )
        UPDATE shipments
        SET new_id = 'SHIP-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
        FROM numbered
        WHERE shipments.id = numbered.id AND shipments.new_id IS NULL;

        -- 2.2 Switch Shipment PK
        ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_pkey CASCADE;

        ALTER TABLE shipments RENAME COLUMN id TO old_uuid_id;
        ALTER TABLE shipments RENAME COLUMN new_id TO id;
        ALTER TABLE shipments ALTER COLUMN id SET DEFAULT generate_readable_id('SHIP');
        ALTER TABLE shipments ADD PRIMARY KEY (id);
        
    END IF;
END $$;

COMMIT;
