-- ATMO Costing - Supabase schema
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.app_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  group_name text not null check (group_name in ('Nhựa','Phụ kiện','Bao bì')),
  unit text not null default '',
  pack_qty numeric not null check (pack_qty > 0),
  purchase_price numeric not null default 0 check (purchase_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, code)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  name text not null,
  plate_qty numeric not null default 1 check (plate_qty > 0),
  plate_hours numeric not null default 0 check (plate_hours >= 0),
  plastics jsonb not null default '[]'::jsonb,
  accessories jsonb not null default '[]'::jsonb,
  packaging jsonb not null default '[]'::jsonb,
  support_minutes numeric not null default 0 check (support_minutes >= 0),
  surface_minutes numeric not null default 0 check (surface_minutes >= 0),
  other_cost numeric not null default 0 check (other_cost >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, code)
);

alter table public.app_settings enable row level security;
alter table public.materials enable row level security;
alter table public.products enable row level security;

-- Policies are intentionally per-user. The anon key is safe to expose only with RLS enabled.
drop policy if exists "settings own rows" on public.app_settings;
create policy "settings own rows" on public.app_settings
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "materials own rows" on public.materials;
create policy "materials own rows" on public.materials
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "products own rows" on public.products;
create policy "products own rows" on public.products
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists materials_user_id_idx on public.materials(user_id);
create index if not exists products_user_id_idx on public.products(user_id);


-- ATMO Costing - Order management
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_code text not null,
  customer_name text not null,
  customer_phone text not null default '',
  channel text not null default 'Trực tiếp',
  status text not null default 'Mới' check (status in ('Mới','Đang chuẩn bị','Sẵn sàng','Đã giao','Hủy')),
  order_date date not null default current_date,
  due_date date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, order_code)
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_code text not null default '',
  product_name text not null default '',
  variant text not null default '',
  quantity integer not null default 1 check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "orders own rows" on public.orders;
create policy "orders own rows" on public.orders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "order items own rows" on public.order_items;
create policy "order items own rows" on public.order_items
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create index if not exists orders_user_id_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(user_id, status);
create index if not exists order_items_order_id_idx on public.order_items(order_id);
create index if not exists order_items_user_id_idx on public.order_items(user_id);

