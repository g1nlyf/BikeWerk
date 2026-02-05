-- Migration to Human Readable IDs and Audit Log
-- Run this script in your Supabase SQL Editor

BEGIN;

-- 1. Setup Sequences and Functions
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

-- Ensure tables exist (referencing UUIDs initially to match migration logic)
CREATE TABLE IF NOT EXISTS leads (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    source text,
    customer_id uuid REFERENCES customers(id),
    bike_url text,
    bike_snapshot jsonb,
    customer_comment text,
    estimated_budget_eur numeric,
    status text,
    created_at timestamptz DEFAULT now()
);

-- 2. MIGRATE CUSTOMERS
-- 2.1 Prepare new ID
ALTER TABLE customers ADD COLUMN IF NOT EXISTS new_id text;
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
  FROM customers
)
UPDATE customers
SET new_id = 'CUST-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE customers.id = numbered.id AND customers.new_id IS NULL;

-- 2.2 Update References (Orders and Leads)
-- Orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS new_customer_id text;
UPDATE orders o
SET new_customer_id = c.new_id
FROM customers c
WHERE o.customer_id = c.id;

-- Leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS new_customer_id text;
UPDATE leads l
SET new_customer_id = c.new_id
FROM customers c
WHERE l.customer_id = c.id;

-- 2.3 Switch Customer PK
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_customer_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_customer_id_fkey;
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_pkey CASCADE;

-- Rename old ID to avoid data loss, promote new ID
ALTER TABLE customers RENAME COLUMN id TO old_uuid_id;
ALTER TABLE customers RENAME COLUMN new_id TO id;
ALTER TABLE customers ALTER COLUMN id SET DEFAULT generate_readable_id('CUST');
ALTER TABLE customers ADD PRIMARY KEY (id);

-- 2.4 Switch Foreign Keys to point to new Customer ID
-- Orders
ALTER TABLE orders DROP COLUMN IF EXISTS customer_id;
ALTER TABLE orders RENAME COLUMN new_customer_id TO customer_id;
ALTER TABLE orders ADD CONSTRAINT orders_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);

-- Leads
ALTER TABLE leads DROP COLUMN IF EXISTS customer_id;
ALTER TABLE leads RENAME COLUMN new_customer_id TO customer_id;
ALTER TABLE leads ADD CONSTRAINT leads_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES customers(id);


-- 3. MIGRATE LEADS (APPLICATIONS)
-- 3.1 Prepare new ID
ALTER TABLE leads ADD COLUMN IF NOT EXISTS new_id text;
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
  FROM leads
)
UPDATE leads
SET new_id = 'LEAD-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE leads.id = numbered.id AND leads.new_id IS NULL;

-- 3.2 Update References (Orders)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS new_lead_id text;
UPDATE orders o
SET new_lead_id = l.new_id
FROM leads l
WHERE o.lead_id = l.id;

-- 3.3 Switch Lead PK
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_lead_id_fkey;
ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_pkey CASCADE;

ALTER TABLE leads RENAME COLUMN id TO old_uuid_id;
ALTER TABLE leads RENAME COLUMN new_id TO id;
ALTER TABLE leads ALTER COLUMN id SET DEFAULT generate_readable_id('LEAD');
ALTER TABLE leads ADD PRIMARY KEY (id);

-- 3.4 Switch Order FK
ALTER TABLE orders DROP COLUMN IF EXISTS lead_id;
ALTER TABLE orders RENAME COLUMN new_lead_id TO lead_id;
ALTER TABLE orders ADD CONSTRAINT orders_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES leads(id);


-- 4. MIGRATE ORDERS
-- 4.1 Prepare new ID
UPDATE orders 
SET order_code = 'ORD-' || to_char(created_at, 'YYYYMMDD') || '-' || substring(id::text, 1, 4) 
WHERE order_code IS NULL;

-- 4.2 Update References (Shipments, Status Events)
-- Shipments
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS new_order_id text;
UPDATE shipments s SET new_order_id = o.order_code FROM orders o WHERE s.order_id = o.id;

-- Order Status Events
ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS new_order_id text;
UPDATE order_status_events e SET new_order_id = o.order_code FROM orders o WHERE e.order_id = o.id;

-- 4.3 Switch Order PK
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_order_id_fkey;
ALTER TABLE order_status_events DROP CONSTRAINT IF EXISTS order_status_events_order_id_fkey;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_pkey CASCADE;

ALTER TABLE orders RENAME COLUMN id TO old_uuid_id;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS new_id text;
UPDATE orders SET new_id = order_code;
ALTER TABLE orders ALTER COLUMN new_id SET DEFAULT generate_readable_id('ORD');
ALTER TABLE orders ADD PRIMARY KEY (new_id);

-- 4.4 Switch Child FKs
-- Shipments
ALTER TABLE shipments DROP COLUMN IF EXISTS order_id;
ALTER TABLE shipments RENAME COLUMN new_order_id TO order_id;
ALTER TABLE shipments ADD CONSTRAINT shipments_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(new_id);

-- Status Events
ALTER TABLE order_status_events DROP COLUMN IF EXISTS order_id;
ALTER TABLE order_status_events RENAME COLUMN new_order_id TO order_id;
ALTER TABLE order_status_events ADD CONSTRAINT order_status_events_order_id_fkey FOREIGN KEY (order_id) REFERENCES orders(new_id);

-- Final cleanup for Orders
ALTER TABLE orders DROP COLUMN IF EXISTS id; 
ALTER TABLE orders RENAME COLUMN new_id TO id;


-- 5. MIGRATE ORDER STATUS EVENTS
-- 5.1 Prepare new ID
ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS new_id text;
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
  FROM order_status_events
)
UPDATE order_status_events
SET new_id = 'EVT-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE order_status_events.id = numbered.id AND order_status_events.new_id IS NULL;

-- 5.2 Switch Event PK
ALTER TABLE order_status_events DROP CONSTRAINT IF EXISTS order_status_events_pkey CASCADE;

ALTER TABLE order_status_events RENAME COLUMN id TO old_uuid_id;
ALTER TABLE order_status_events RENAME COLUMN new_id TO id;
ALTER TABLE order_status_events ALTER COLUMN id SET DEFAULT generate_readable_id('EVT');
ALTER TABLE order_status_events ADD PRIMARY KEY (id);


-- 6. MIGRATE SHIPMENTS
-- 6.1 Prepare new ID
ALTER TABLE shipments ADD COLUMN IF NOT EXISTS new_id text;
WITH numbered AS (
  SELECT id, row_number() OVER (ORDER BY created_at) as rn, created_at
  FROM shipments
)
UPDATE shipments
SET new_id = 'SHIP-' || to_char(numbered.created_at, 'YYYYMMDD') || '-' || lpad(numbered.rn::text, 4, '0')
FROM numbered
WHERE shipments.id = numbered.id AND shipments.new_id IS NULL;

-- 6.2 Switch Shipment PK
ALTER TABLE shipments DROP CONSTRAINT IF EXISTS shipments_pkey CASCADE;

ALTER TABLE shipments RENAME COLUMN id TO old_uuid_id;
ALTER TABLE shipments RENAME COLUMN new_id TO id;
ALTER TABLE shipments ALTER COLUMN id SET DEFAULT generate_readable_id('SHIP');
ALTER TABLE shipments ADD PRIMARY KEY (id);


-- 7. CREATE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    actor_id text,
    action text,
    entity text,
    entity_id text,
    payload jsonb,
    created_at timestamptz DEFAULT now()
);

COMMIT;
