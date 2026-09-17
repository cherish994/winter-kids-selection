-- 小孩 / 衣橱：Supabase 初始结构
-- 在 Supabase Dashboard → SQL Editor → New query 中完整运行一次。
-- 不要把 service_role key 或数据库密码写进前端、GitHub 或任何截图里。

create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  brand text not null default '小孩 / 衣橱',
  name text not null,
  category text not null default '冬季单品',
  description text,
  age_groups text[] not null default '{}',
  scenes text[] not null default '{}',
  height_min integer check (height_min between 40 and 170),
  height_max integer check (height_max between 40 and 170),
  retail_price numeric(10,2) check (retail_price >= 0),
  purchase_url text,
  cover_image_url text,
  status text not null default 'draft' check (status in ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (height_min is null or height_max is null or height_min <= height_max)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- 仅店主内部使用：它不包含在顾客端接口权限中。
-- 实际成本固定为 快团团售价 - 帮卖佣金，避免手算或误展示。
create table if not exists public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.products(id) on delete cascade,
  source_name text not null default '快团团',
  source_product_url text,
  source_screenshot_path text,
  ktt_sale_price numeric(10,2) not null check (ktt_sale_price >= 0),
  affiliate_commission numeric(10,2) not null default 0 check (affiliate_commission >= 0),
  actual_cost numeric(10,2) generated always as (ktt_sale_price - affiliate_commission) stored,
  source_captured_at timestamptz,
  created_at timestamptz not null default now(),
  check (affiliate_commission <= ktt_sale_price)
);

create table if not exists public.upload_batches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  source_screenshot_path text,
  status text not null default 'uploaded' check (status in ('uploaded', 'matching', 'review', 'completed')),
  created_at timestamptz not null default now()
);

create index if not exists products_public_catalog_idx on public.products (status, published_at desc);
create index if not exists product_images_product_idx on public.product_images (product_id, sort_order);
create index if not exists products_scenes_idx on public.products using gin (scenes);

alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sources enable row level security;
alter table public.upload_batches enable row level security;

-- Data API 默认不会自动暴露新表。下面只授权匿名访问已发布的前台商品与其图片。
grant usage on schema public to anon;
grant select on public.products, public.product_images to anon;
revoke all on public.product_sources, public.upload_batches from anon, authenticated;

drop policy if exists "Public can read published products" on public.products;
create policy "Public can read published products"
  on public.products for select to anon
  using (status = 'published');

drop policy if exists "Public can read images for published products" on public.product_images;
create policy "Public can read images for published products"
  on public.product_images for select to anon
  using (exists (
    select 1 from public.products p
    where p.id = product_images.product_id and p.status = 'published'
  ));

-- 高清、已审核的前台图片放这里；顾客可读取。
insert into storage.buckets (id, name, public)
values ('product-public', 'product-public', true)
on conflict (id) do update set public = true;

-- 快团团截图、待匹配素材放这里；不要设为公开。
insert into storage.buckets (id, name, public)
values ('product-private', 'product-private', false)
on conflict (id) do update set public = false;

drop policy if exists "Public can view approved product files" on storage.objects;
create policy "Public can view approved product files"
  on storage.objects for select to anon
  using (bucket_id = 'product-public');

-- 示例发布步骤（替换为自己的商品资料；内部成本请只写入 product_sources）：
-- insert into public.products
--   (sku, brand, name, category, description, age_groups, scenes, height_min, height_max, retail_price, purchase_url, cover_image_url, status, published_at)
-- values
--   ('324', 'ROTOTO BEBE', '复古撞色居家服', '居家服', '...', array['1–5 岁'], array['日常'], 80, 110, 199, 'https://你的购买链接', 'https://.../product-public/324-cover.jpg', 'published', now());
