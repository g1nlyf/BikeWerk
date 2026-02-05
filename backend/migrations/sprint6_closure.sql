-- Sprint 6: Final Closure & Feedback Loop

-- Audit Log Table (if not exists)
CREATE TABLE IF NOT EXISTS public.audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    action text NOT NULL,
    entity text NOT NULL, -- 'orders', 'tasks', etc.
    entity_id text NOT NULL,
    payload jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    user_id uuid -- Optional: who performed the action
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id uuid REFERENCES public.orders(id),
    customer_id uuid REFERENCES public.customers(id),
    rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment text,
    sentiment_score numeric, -- Gemini analysis (0.0 to 1.0 or -1.0 to 1.0)
    sentiment_label text, -- 'positive', 'neutral', 'negative'
    created_at timestamp with time zone DEFAULT now()
);

-- Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    code text UNIQUE NOT NULL,
    discount_amount numeric(10, 2), -- Fixed amount
    discount_percent numeric(5, 2), -- Percentage
    status text DEFAULT 'active', -- active, used, expired
    customer_id uuid REFERENCES public.customers(id),
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone
);

-- Add index
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.reviews(order_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(code);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON public.audit_log(entity_id);
