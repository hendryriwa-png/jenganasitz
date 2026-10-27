-- ============================================================
-- Restrict vendor order updates to status only
-- Applied after 20261028000000_storefront_orders.sql
-- ============================================================

-- Vendors may advance the status of their own orders, but must not be able to
-- rewrite totals, items, customer details, or the vendor assignment.
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

-- The checkout RPC is for signed-in customers only.
revoke execute on function public.place_marketplace_order(jsonb, text, text, text, text) from anon;
