-- =============================================
-- 🛠 FIX: Schema & User Registration (Sprint 1.1.2)
-- =============================================

-- 1. Add telegram_id to users table if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'telegram_id') THEN
        ALTER TABLE public.users ADD COLUMN telegram_id bigint;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_id ON public.users(telegram_id);
    END IF;
END$$;

-- 2. Register/Update Manager 'Vlad'
-- We use ON CONFLICT DO UPDATE to ensure the record is correct.
-- Since we don't have a unique constraint on 'name' reliably, we try to match by telegram_id if it exists, or insert.
-- Best approach: Delete any existing 'Vlad' or user with this telegram_id to be clean, then insert.

DELETE FROM public.users WHERE telegram_id = 1076231865;
DELETE FROM public.users WHERE name = 'Vlad';

INSERT INTO public.users (name, role, active, telegram_id)
VALUES ('Vlad', 'manager', true, 1076231865);

-- 3. Verify Manager Subscribers (Optional, but good for redundancy)
-- If table exists, link it.
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'manager_subscribers') THEN
        INSERT INTO public.manager_subscribers (telegram_id, username, user_id)
        VALUES (
            1076231865, 
            'Vlad', 
            (SELECT id FROM public.users WHERE telegram_id = 1076231865 LIMIT 1)
        )
        ON CONFLICT (telegram_id) 
        DO UPDATE SET user_id = EXCLUDED.user_id, username = 'Vlad';
    END IF;
END$$;
