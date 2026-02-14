-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- https://supabase.com/dashboard/project/_/sql

-- Inventory table
create table if not exists public.inventory (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric not null default 0,
  quantity integer not null default 0,
  description text default '',
  created_at timestamptz default now()
);

-- Sales table
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.inventory(id) on delete set null,
  item_name text not null,
  quantity integer not null,
  price numeric not null,
  total numeric not null,
  customer_name text default '',
  date timestamptz default now()
);

-- Allow anonymous read/write for the app (optional: tighten with Row Level Security later)
alter table public.inventory enable row level security;
alter table public.sales enable row level security;

create policy "Allow all for inventory" on public.inventory
  for all using (true) with check (true);

create policy "Allow all for sales" on public.sales
  for all using (true) with check (true);
