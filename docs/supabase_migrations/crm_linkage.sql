-- CRM linkage migration package
-- Prepared on 2026-02-07
-- NOTE: Prepared only. Do not apply automatically from app startup.

BEGIN;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS external_bike_ref text;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS cached_images jsonb DEFAULT '[]'::jsonb;

ALTER TABLE IF EXISTS public.orders
  ADD COLUMN IF NOT EXISTS archived_bike boolean DEFAULT false;

ALTER TABLE IF EXISTS public.leads
  ADD COLUMN IF NOT EXISTS bike_snapshot jsonb;

CREATE TABLE IF NOT EXISTS public.lead_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Supabase snapshot shows `leads.id` is a human-readable `text` ID (not uuid).
  lead_id text NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid NULL REFERENCES public.users(id),
  changed_by_role text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_external_bike_ref ON public.orders(external_bike_ref);
CREATE INDEX IF NOT EXISTS idx_orders_archived_bike ON public.orders(archived_bike);
CREATE INDEX IF NOT EXISTS idx_lead_status_events_lead_id ON public.lead_status_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_status_events_created_at ON public.lead_status_events(created_at DESC);

COMMIT;
