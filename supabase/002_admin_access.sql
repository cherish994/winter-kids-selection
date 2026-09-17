-- 店主后台权限：在首次打开 /admin 并完成邮箱登录后运行。
-- 将下面的 YOUR_LOGIN_EMAIL 改成店主登录后台时使用的邮箱。
-- 这份脚本不会公开内部成本，也不会影响顾客端的已发布商品读取权限。

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

create or replace function public.is_shop_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_shop_admin() from public;
grant execute on function public.is_shop_admin() to authenticated;

grant select on public.admin_users to authenticated;
grant select, insert, update, delete on public.products, public.product_images, public.product_sources, public.upload_batches to authenticated;

drop policy if exists "Admin can view own access" on public.admin_users;
create policy "Admin can view own access"
  on public.admin_users for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "Shop admins manage products" on public.products;
create policy "Shop admins manage products"
  on public.products for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

drop policy if exists "Shop admins manage product images" on public.product_images;
create policy "Shop admins manage product images"
  on public.product_images for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

drop policy if exists "Shop admins manage product sources" on public.product_sources;
create policy "Shop admins manage product sources"
  on public.product_sources for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

drop policy if exists "Shop admins manage upload batches" on public.upload_batches;
create policy "Shop admins manage upload batches"
  on public.upload_batches for all to authenticated
  using (public.is_shop_admin())
  with check (public.is_shop_admin());

drop policy if exists "Shop admins can view private assets" on storage.objects;
create policy "Shop admins can view private assets"
  on storage.objects for select to authenticated
  using (bucket_id in ('product-public', 'product-private') and public.is_shop_admin());

drop policy if exists "Shop admins can upload assets" on storage.objects;
create policy "Shop admins can upload assets"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('product-public', 'product-private') and public.is_shop_admin());

drop policy if exists "Shop admins can update assets" on storage.objects;
create policy "Shop admins can update assets"
  on storage.objects for update to authenticated
  using (bucket_id in ('product-public', 'product-private') and public.is_shop_admin())
  with check (bucket_id in ('product-public', 'product-private') and public.is_shop_admin());

drop policy if exists "Shop admins can delete assets" on storage.objects;
create policy "Shop admins can delete assets"
  on storage.objects for delete to authenticated
  using (bucket_id in ('product-public', 'product-private') and public.is_shop_admin());

-- 第一次登录后，只需把下面这一行的邮箱替换为你的登录邮箱并运行一次：
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'YOUR_LOGIN_EMAIL'
-- on conflict (user_id) do nothing;
