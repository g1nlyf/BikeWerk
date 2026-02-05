-- Sprint 3 Fix: Add manager_notes to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS manager_notes text;

-- Ensure tasks has ai_generated (if Sprint 2 migration wasn't run fully)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS ai_generated boolean DEFAULT false;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bike_component text;
