-- 内部货源清单：在尚未匹配高清图前，保存快团团的款号、展示价与分类。
-- 这个表不给匿名顾客访问；只有已开通的店主账号可读写。

create table if not exists public.source_items (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  supplier_sku text not null,
  source_title text not null,
  normalized_name text,
  category text not null default '冬季单品',
  ktt_sale_price numeric(10,2) not null check (ktt_sale_price >= 0),
  affiliate_commission numeric(10,2) check (affiliate_commission >= 0 and affiliate_commission <= ktt_sale_price),
  actual_cost numeric(10,2) generated always as (
    case
      when affiliate_commission is null then null
      else ktt_sale_price - affiliate_commission
    end
  ) stored,
  ktt_group_url text,
  source_status text not null default 'awaiting_assets'
    check (source_status in ('awaiting_assets', 'matched', 'archived')),
  source_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand, supplier_sku)
);

alter table public.source_items enable row level security;
grant select, insert, update, delete on public.source_items to authenticated;

drop policy if exists "Shop admins manage source items" on public.source_items;
create policy "Shop admins manage source items"
  on public.source_items for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());
