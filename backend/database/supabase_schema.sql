-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Customers Table (CRM Core)
create table if not exists customers (
    id uuid default uuid_generate_v4() primary key,
    email text unique,
    phone text,
    full_name text,
    telegram_id text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    metadata jsonb default '{}'::jsonb
);

-- 2. Orders Table (The Deal)
create table if not exists orders (
    id uuid default uuid_generate_v4() primary key,
    order_code text unique not null,
    customer_id uuid references customers(id),
    bike_id text, -- Link to local SQLite bike ID
    status text default 'new', -- new, negotiation, inspection, payment, logistics, delivered
    total_amount numeric,
    currency text default 'EUR',
    magic_link_token text unique, -- For tracker access
    timeline_events jsonb default '[]'::jsonb, -- Array of {date, title, description, photoUrl, status}
    manager_notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Storage Bucket Policy (pseudo-code, run in Supabase Dashboard or via API if possible)
-- insert into storage.buckets (id, name, public) values ('order-assets', 'order-assets', true);
-- create policy "Public Access" on storage.objects for select using ( bucket_id = 'order-assets' );
