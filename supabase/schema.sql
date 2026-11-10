-- =====================================================================
-- Cravely - skema Supabase (PostgreSQL)
-- Jalankan sekali di: Supabase Dashboard -> SQL Editor -> New query -> Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- Helper
-- ---------------------------------------------------------------------

-- ID 24 karakter hex (format sama seperti ObjectId MongoDB), jadi view yang
-- memotong id (mis. substring(18, 24) / slice(-6)) tetap jalan apa adanya.
create or replace function public.new_id()
returns text
language sql
volatile
set search_path = ''
as $$
  select substr(replace(gen_random_uuid()::text, '-', ''), 1, 24)
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------

create table public.users (
  id           text primary key default public.new_id(),
  fullname     text not null,
  email        text not null unique,
  username     text not null unique,
  password     text not null,
  role         text not null default 'customer' check (role in ('customer', 'admin')),
  phone_number text not null,
  address      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.products (
  id             text primary key default public.new_id(),
  name           text not null,
  category       text not null check (category in ('sweet', 'savory')),
  description    text not null,
  price          numeric not null,
  image          text not null,
  is_active      text not null check (is_active in ('ready stok', 'pre order')),
  -- sengaja tanpa CHECK (stock >= 0): stok dikurangi saat order dibuat dan
  -- sebelumnya (MongoDB $inc) juga tidak menolak stok minus.
  stock          integer not null default 0,
  discount       numeric not null default 0 check (discount between 0 and 100),
  is_best_seller boolean not null default false,
  detail         jsonb not null default '{"gallery": [], "ingredients": []}'::jsonb,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.orders (
  id               text primary key default public.new_id(),
  order_number     text unique,
  user_id          text references public.users (id) on delete set null,
  -- [{ "product": "<product id>", "quantity": 2, "price": 15000 }]
  items            jsonb not null default '[]'::jsonb,
  total_amount     numeric not null,
  payment_proof    text,
  status           text not null default 'Waiting Payment' check (
    status in (
      'Waiting Payment', 'Payment Verification', 'Confirmed', 'In Production',
      'Ready for Delivery', 'Delivered', 'Completed', 'Rejected'
    )
  ),
  shipping_address text not null,
  customer_note    text,
  payment_method   text not null check (payment_method in ('Transfer', 'QRIS', 'COD')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.payments (
  id             text primary key default public.new_id(),
  payment_number text not null unique,
  order_id       text references public.orders (id) on delete set null,
  user_id        text references public.users (id) on delete set null,
  payment_method text not null,
  total_amount   numeric not null,
  payment_proof  text,
  status         text not null default 'Waiting Payment' check (
    status in ('Waiting Payment', 'Payment Verification', 'Confirmed', 'Rejected')
  ),
  payment_date   timestamptz not null default now(),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.carts (
  id         text primary key default public.new_id(),
  user_id    text not null unique references public.users (id) on delete cascade,
  -- [{ "product": "<product id>", "quantity": 1 }]
  items      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wishlists (
  id         text primary key default public.new_id(),
  user_id    text not null unique references public.users (id) on delete cascade,
  -- ["<product id>", "<product id>"]
  products   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id         text primary key default public.new_id(),
  product_id text references public.products (id) on delete set null,
  user_id    text references public.users (id) on delete set null,
  rating     numeric not null check (rating between 1 and 5),
  comment    text not null,
  status     text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id             text primary key default public.new_id(),
  recipient_role text not null check (recipient_role in ('admin', 'customer')),
  recipient      text references public.users (id) on delete set null,
  type           text not null default 'system' check (type in ('order', 'payment', 'review', 'system')),
  title          text not null,
  message        text not null,
  link           text not null default '/dashboard/notifications',
  read_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table public.raw_materials (
  id            text primary key default public.new_id(),
  name          text not null,
  unit          text not null default 'kg',
  stock         numeric not null default 0 check (stock >= 0),
  minimum_stock numeric not null default 0 check (minimum_stock >= 0),
  unit_cost     numeric not null default 0 check (unit_cost >= 0),
  supplier      text not null default '',
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.expenses (
  id              text primary key default public.new_id(),
  type            text not null default 'material' check (type in ('capital', 'material', 'operational', 'other')),
  description     text not null,
  amount          numeric not null check (amount >= 0),
  date            timestamptz not null default now(),
  raw_material_id text references public.raw_materials (id) on delete set null,
  created_by      text references public.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.pre_order_settings (
  id         text primary key default public.new_id(),
  key        text not null unique default 'current',
  is_open    boolean not null default true,
  updated_by text references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Index
-- ---------------------------------------------------------------------
create index orders_user_id_idx        on public.orders (user_id);
create index orders_created_at_idx     on public.orders (created_at desc);
create index orders_items_gin_idx      on public.orders using gin (items);
create index payments_order_id_idx     on public.payments (order_id);
create index payments_user_id_idx      on public.payments (user_id);
create index reviews_product_id_idx    on public.reviews (product_id);
create index reviews_user_id_idx       on public.reviews (user_id);
create index notifications_role_idx    on public.notifications (recipient_role, created_at desc);
create index expenses_raw_material_idx on public.expenses (raw_material_id);

-- ---------------------------------------------------------------------
-- Trigger updated_at (pengganti `timestamps: true` di Mongoose)
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'products', 'orders', 'payments', 'carts', 'wishlists', 'reviews',
    'notifications', 'raw_materials', 'expenses', 'pre_order_settings'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Increment atomik (pengganti operator $inc MongoDB)
-- Hanya boleh dipanggil oleh server (service_role).
-- ---------------------------------------------------------------------
create or replace function public.app_increment(
  p_table  text,
  p_id     text,
  p_column text,
  p_delta  numeric
)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if (p_table, p_column) not in (('products', 'stock'), ('raw_materials', 'stock')) then
    raise exception 'app_increment: % . % tidak diizinkan', p_table, p_column;
  end if;

  execute format(
    'update public.%I set %I = %I + $1 where id = $2',
    p_table, p_column, p_column
  ) using p_delta, p_id;
end;
$$;

revoke all on function public.app_increment(text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.app_increment(text, text, text, numeric) to service_role;

-- ---------------------------------------------------------------------
-- Keamanan: aktifkan RLS di semua tabel.
-- Tanpa policy, anon/authenticated key TIDAK bisa baca/tulis apa pun
-- (penting: tabel users berisi hash password). Server Express memakai
-- service_role key yang mem-bypass RLS.
-- ---------------------------------------------------------------------
alter table public.users              enable row level security;
alter table public.products           enable row level security;
alter table public.orders             enable row level security;
alter table public.payments           enable row level security;
alter table public.carts              enable row level security;
alter table public.wishlists          enable row level security;
alter table public.reviews            enable row level security;
alter table public.notifications      enable row level security;
alter table public.raw_materials      enable row level security;
alter table public.expenses           enable row level security;
alter table public.pre_order_settings enable row level security;

-- ---------------------------------------------------------------------
-- Realtime: daftarkan semua tabel ke publication supabase_realtime
-- ---------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'products', 'orders', 'payments', 'carts', 'wishlists', 'reviews',
    'notifications', 'raw_materials', 'expenses', 'pre_order_settings'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null; -- sudah terdaftar
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Admin pertama
-- Register di aplikasi selalu membuat role "customer". Setelah daftar lewat
-- halaman /auth/register, jadikan akun itu admin dengan:
--
--   update public.users set role = 'admin' where email = 'emailkamu@contoh.com';
-- ---------------------------------------------------------------------
