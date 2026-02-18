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

-- Stores table (before employees so employees can reference store_id)
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#333333',
  display_order integer not null default 0,
  created_at timestamptz default now()
);

-- Store daily sales (amount per store per day)
create table if not exists public.store_daily_sales (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete cascade not null,
  date date not null,
  amount numeric not null default 0,
  unique(store_id, date)
);

-- Employees table
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  salary_rate numeric not null default 0,
  display_order integer not null default 0,
  store_id uuid references public.stores(id) on delete set null,
  created_at timestamptz default now()
);

-- For existing databases: run this if employees table already exists without salary_rate
-- alter table public.employees add column if not exists salary_rate numeric not null default 0;

-- For existing databases: run this if employees table already exists without display_order
-- alter table public.employees add column if not exists display_order integer not null default 0;

-- For existing databases: run after stores exists: alter table public.employees add column if not exists store_id uuid references public.stores(id) on delete set null;
-- For existing databases: alter table public.stores add column if not exists color text not null default '#333333';

-- Attendance table (one row per employee per day when present)
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  date date not null,
  unique(employee_id, date)
);

-- Weekly payments (tracks if employee was paid for a specific week)
create table if not exists public.weekly_payments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  week_start date not null,
  paid boolean not null default false,
  unique(employee_id, week_start)
);

-- Weekly deductions (cash advance, salary deductions per employee per week)
create table if not exists public.weekly_deductions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid references public.employees(id) on delete cascade not null,
  week_start date not null,
  amount numeric not null default 0,
  unique(employee_id, week_start)
);

-- Allow anonymous read/write for the app (optional: tighten with Row Level Security later)
alter table public.inventory enable row level security;
alter table public.sales enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.weekly_payments enable row level security;
alter table public.weekly_deductions enable row level security;
alter table public.stores enable row level security;
alter table public.store_daily_sales enable row level security;

create policy "Allow all for inventory" on public.inventory
  for all using (true) with check (true);

create policy "Allow all for sales" on public.sales
  for all using (true) with check (true);

create policy "Allow all for employees" on public.employees
  for all using (true) with check (true);

create policy "Allow all for attendance" on public.attendance
  for all using (true) with check (true);

create policy "Allow all for weekly_payments" on public.weekly_payments
  for all using (true) with check (true);

create policy "Allow all for weekly_deductions" on public.weekly_deductions
  for all using (true) with check (true);

create policy "Allow all for stores" on public.stores
  for all using (true) with check (true);

create policy "Allow all for store_daily_sales" on public.store_daily_sales
  for all using (true) with check (true);
