-- Add bike_specs_confirmed to inspections table
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS bike_specs_confirmed jsonb;
