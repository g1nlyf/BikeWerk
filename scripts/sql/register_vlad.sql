-- =============================================
-- 🛠 FIX: Manual Manager Registration
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create User 'Vlad' if not exists
INSERT INTO public.users (name, role, active, telegram_id) 
VALUES ('Vlad', 'manager', true, 1076231865) 
ON CONFLICT (email) DO NOTHING; -- Assuming email is unique constraint, but schema says email unique.
-- Wait, schema says users.id is UUID PK. Name is not unique. 
-- Let's check if we can upsert by telegram_id if it exists, or name.
-- Since we don't have unique constraint on name or telegram_id in all schemas (canonical has email unique),
-- best is to insert and ignore if telegram_id matches.

-- Actually, better to check if exists first to avoid duplicates if constraints are loose.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE telegram_id = '1076231865') THEN
        INSERT INTO public.users (name, role, active, telegram_id) 
        VALUES ('Vlad', 'manager', true, 1076231865);
    END IF;
END$$;


-- 2. Link in manager_subscribers (if table exists)
-- This table might not exist in canonical schema, but user mentioned it.
-- We'll wrap in a block to avoid error if table missing.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manager_subscribers') THEN
        INSERT INTO public.manager_subscribers (telegram_id, username, user_id) 
        VALUES (1076231865, 'Vlad', (SELECT id FROM public.users WHERE telegram_id = '1076231865' LIMIT 1)) 
        ON CONFLICT (telegram_id) 
        DO UPDATE SET user_id = EXCLUDED.user_id, username = 'Vlad';
    END IF;
END$$;
