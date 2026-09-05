-- Run this file once in Supabase SQL Editor to add Order Management.

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
