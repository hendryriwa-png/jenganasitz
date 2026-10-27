-- Marketplace hardening: registration, admin access, and RLS.
-- Safe to run more than once.

-- Products are sorted by "newest" in the storefront.
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);

-- Vendors may register before they have supplied payout details.
ALTER TABLE vendors ALTER COLUMN bank_account DROP NOT NULL;

-- Dedicated admin registry. Admin status is never inferred from user-editable
-- metadata; it must exist in this table (or in app_metadata, which only the
-- service role can write).
CREATE TABLE IF NOT EXISTS public.admins (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view own record" ON public.admins;
CREATE POLICY "Admins can view own record" ON public.admins
  FOR SELECT TO authenticated USING (auth.uid() = id);

REVOKE ALL ON public.admins FROM anon;
GRANT SELECT ON public.admins TO authenticated;
GRANT ALL ON public.admins TO service_role;

-- Helper used by RLS policies. SECURITY DEFINER so it can read admins even when
-- the caller has no direct access, with an empty search_path to avoid hijacking.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admins WHERE id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Customers and vendors create their own profile row immediately after signup.
DROP POLICY IF EXISTS "Customers can insert own profile" ON customers;
CREATE POLICY "Customers can insert own profile" ON customers
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Vendors can insert own profile" ON vendors;
CREATE POLICY "Vendors can insert own profile" ON vendors
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

GRANT INSERT ON customers, vendors TO authenticated;

-- Admins need to see the whole marketplace from the admin console.
DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers" ON customers
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all vendors" ON vendors;
CREATE POLICY "Admins can view all vendors" ON vendors
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update vendors" ON vendors;
CREATE POLICY "Admins can update vendors" ON vendors
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can view all products" ON products;
CREATE POLICY "Admins can view all products" ON products
  FOR SELECT TO authenticated USING (public.is_admin());

-- Keep public product reads restricted to live listings.
DROP POLICY IF EXISTS "Anyone can view active products" ON products;
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (status = 'active' AND deleted = false);

-- The legacy SECURITY DEFINER profile helpers let anonymous callers write
-- arbitrary profile rows. They are no longer used by the client; keep them
-- available only to the service role.
REVOKE ALL ON FUNCTION public.create_vendor_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_vendor_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT
) TO service_role;

REVOKE ALL ON FUNCTION public.create_customer_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_customer_profile(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO service_role;
