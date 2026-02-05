-- Fix missing updated_at and add comprehensive inspection checklist fields
-- Run this in Supabase SQL Editor

-- 1. Fix missing 'updated_at' column in inspections
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. Add 'checklist' column for structured inspection data (5 sections)
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS checklist jsonb DEFAULT '{}'::jsonb;

-- 3. Add 'photos_status' column for tracking required photos
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS photos_status jsonb DEFAULT '{}'::jsonb;

-- 4. Add 'next_action_suggestion' for AI-driven manager guidance
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS next_action_suggestion text;

-- 5. Create trigger to automatically update 'updated_at'
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_inspections_updated_at ON public.inspections;
CREATE TRIGGER update_inspections_updated_at
    BEFORE UPDATE ON public.inspections
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 6. Initialize checklist structure for existing rows (optional but good for consistency)
UPDATE public.inspections 
SET checklist = '{
    "identification": {},
    "specs": {},
    "history": {},
    "maintenance": {},
    "configuration": {}
}'::jsonb
WHERE checklist IS NULL OR checklist = '{}'::jsonb;

-- 7. Initialize photos_status
UPDATE public.inspections
SET photos_status = '{
    "serial_number": false,
    "fork_stanchions": false,
    "frame_defects": false,
    "drivetrain": false,
    "brake_levers": false,
    "full_bike": false,
    "shock": false
}'::jsonb
WHERE photos_status IS NULL OR photos_status = '{}'::jsonb;

NOTIFY pgrst, 'reload schema';
