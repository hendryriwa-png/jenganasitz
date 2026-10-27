-- ============================================================
-- Storefront vendor directory + real order placement
-- Applied after 20261027000000_marketplace_hardening.sql
-- ============================================================

-- Public, read-only vendor directory. Vendors are otherwise protected by
-- per-account RLS, so the storefront gets a narrow view instead of exposing
-- contact, KYC, or banking columns.
drop view if exists public.public_vendors;

create view public.public_vendors
with (security_barrier = true) as
select
  v.id,
  coalesce(nullif(trim(v.store_name), ''), v.name) as store_name,
  v.region,
  v.photo,
  v.vendor_type,
  v.verified,
  v.joined_at,
  (count(p.id) filter (where p.status = 'active' and p.deleted = false))::int as product_count,
  round(avg(p.rating) filter (where p.status = 'active' and p.deleted = false), 2) as rating,
  (coalesce(sum(p.reviews) filter (where p.status = 'active' and p.deleted = false), 0))::int as reviews
from public.vendors v
left join public.products p on p.vendor_email = v.email
where v.verified = true and coalesce(v.suspended, false) = false
group by v.id, v.store_name, v.name, v.region, v.photo, v.vendor_type, v.verified, v.joined_at;

revoke all on public.public_vendors from public;
grant select on public.public_vendors to anon, authenticated;

-- Server-side checkout. Prices, stock, and vendor ownership are read from the
-- database so the browser cannot choose its own totals. One order row is
-- created per vendor and all rows share a group id.
create or replace function public.place_marketplace_order(
  p_items jsonb,
  p_address text,
  p_phone text,
  p_region text default null,
  p_payment_method text default 'cash_on_delivery'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_name text;
  v_group_id text;
  v_order_id uuid;
  v_order_ids uuid[] := '{}';
  v_total numeric := 0;
  v_vendor_count int;
  v_row record;
begin
  if v_uid is null then
    raise exception 'Please sign in to place an order.' using errcode = '28000';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Your cart is empty.';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception 'An order can contain at most 50 items.';
  end if;

  if coalesce(trim(p_address), '') = '' then
    raise exception 'Please enter a delivery address.';
  end if;

  if coalesce(trim(p_phone), '') = '' then
    raise exception 'Please enter a phone number for delivery.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where (item->>'quantity') is null or (item->>'quantity') !~ '^[0-9]+$'
  ) then
    raise exception 'One or more quantities are invalid.';
  end if;

  select c.email, c.name into v_email, v_name
  from public.customers c
  where c.id = v_uid;

  if v_email is null then
    select u.email, coalesce(nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1))
    into v_email, v_name
    from auth.users u
    where u.id = v_uid;
  end if;

  if v_email is null then
    raise exception 'Your account is missing an email address. Please sign in again.';
  end if;

  create temp table _jn_cart (
    product_id uuid,
    vendor_email text,
    vendor text,
    name text,
    price numeric,
    unit text,
    quantity int,
    stock int
  ) on commit drop;

  insert into pg_temp._jn_cart (product_id, vendor_email, vendor, name, price, unit, quantity, stock)
  select
    p.id,
    p.vendor_email,
    coalesce(nullif(trim(p.vendor), ''), 'Verified vendor'),
    p.name,
    p.price,
    coalesce(nullif(trim(p.unit), ''), 'unit'),
    sum((item->>'quantity')::int),
    max(p.stock)
  from jsonb_array_elements(p_items) item
  join public.products p on p.id::text = item->>'product_id'
  where p.status = 'active'
    and p.deleted = false
    and p.vendor_email is not null
  group by p.id, p.vendor_email, p.vendor, p.name, p.price, p.unit;

  if (select count(*) from pg_temp._jn_cart) = 0 then
    raise exception 'None of these products are available right now.';
  end if;

  if (select count(*) from pg_temp._jn_cart) <> jsonb_array_length(p_items) then
    raise exception 'One or more products are no longer available. Please refresh your cart.';
  end if;

  if exists (select 1 from pg_temp._jn_cart where quantity < 1) then
    raise exception 'Quantities must be at least 1.';
  end if;

  if exists (select 1 from pg_temp._jn_cart where quantity > stock) then
    raise exception 'One or more products do not have enough stock. Please reduce the quantity.';
  end if;

  p_payment_method := coalesce(p_payment_method, 'cash_on_delivery');
  if p_payment_method not in ('cash_on_delivery', 'mpesa_on_delivery') then
    p_payment_method := 'cash_on_delivery';
  end if;

  select count(distinct vendor_email) into v_vendor_count from pg_temp._jn_cart;
  v_group_id := 'JN-' || to_char(now(), 'YYMMDD') || '-' ||
    upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));

  for v_row in
    select
      vendor_email,
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'name', name,
          'price', price,
          'unit', unit,
          'quantity', quantity,
          'line_total', round(price * quantity, 2)
        ) order by name
      ) as items,
      sum(round(price * quantity, 2)) as total
    from pg_temp._jn_cart
    group by vendor_email
  loop
    insert into public.orders (
      group_id, vendor_count, customer, items, total, status, delivery, payment,
      tracking, date, vendor_email, customer_id, customer_email
    ) values (
      v_group_id,
      v_vendor_count,
      jsonb_build_object('name', v_name, 'email', v_email, 'phone', left(trim(p_phone), 40)),
      v_row.items,
      v_row.total,
      'pending',
      jsonb_build_object(
        'address', left(trim(p_address), 500),
        'phone', left(trim(p_phone), 40),
        'region', left(coalesce(trim(p_region), ''), 80),
        'status', 'pending'
      ),
      jsonb_build_object('method', p_payment_method, 'status', 'pending'),
      '[]'::jsonb,
      now(),
      v_row.vendor_email,
      v_uid,
      v_email
    )
    returning id into v_order_id;

    v_order_ids := v_order_ids || v_order_id;
    v_total := v_total + v_row.total;

    update public.products p
    set stock = greatest(0, p.stock - c.quantity)
    from pg_temp._jn_cart c
    where p.id = c.product_id and c.vendor_email = v_row.vendor_email;
  end loop;

  return jsonb_build_object(
    'group_id', v_group_id,
    'order_ids', to_jsonb(v_order_ids),
    'vendor_count', v_vendor_count,
    'total', v_total
  );
end;
$$;

revoke all on function public.place_marketplace_order(jsonb, text, text, text, text) from public;
grant execute on function public.place_marketplace_order(jsonb, text, text, text, text) to authenticated;

-- Vendors may advance the status of their own orders from the dashboard.
drop policy if exists "Vendors can update own orders" on public.orders;
create policy "Vendors can update own orders"
on public.orders for update
to authenticated
using (
  vendor_email in (select email from public.vendors where id = auth.uid())
)
with check (
  vendor_email in (select email from public.vendors where id = auth.uid())
);

create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_vendor_email_idx on public.orders (vendor_email);
create index if not exists orders_group_id_idx on public.orders (group_id);
create index if not exists products_vendor_email_idx on public.products (vendor_email);
