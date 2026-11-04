-- ============================================================
-- Admin moderation controls + device image storage
-- Apply after 20261028000001_order_status_only.sql
-- ============================================================

-- ------------------------------------------------------------------
-- Legacy composite primary key repair
--
-- The original tables were created with composite primary keys that
-- span every column. That makes large text columns (product images,
-- order JSON) part of the btree key, so saves fail with errors such
-- as "index row requires ... maximum size is 8191" even though the
-- value itself is valid. Every id below is a unique UUID, so the id
-- column becomes the real primary key.
-- ------------------------------------------------------------------

DO $$
DECLARE
  pk_name text;
  pk_cols text[];
BEGIN
  SELECT tc.constraint_name,
         array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
    INTO pk_name, pk_cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
     AND kcu.table_name = tc.table_name
   WHERE tc.table_schema = 'public'
     AND tc.table_name = 'products'
     AND tc.constraint_type = 'PRIMARY KEY'
   GROUP BY tc.constraint_name;

  IF pk_name IS NOT NULL AND pk_cols <> ARRAY['id'] THEN
    EXECUTE format('ALTER TABLE public.products DROP CONSTRAINT %I', pk_name);
    pk_name := NULL;
  END IF;
  IF pk_name IS NULL THEN
    ALTER TABLE public.products ADD CONSTRAINT products_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
DECLARE
  pk_name text;
  pk_cols text[];
BEGIN
  SELECT tc.constraint_name,
         array_agg(kcu.column_name::text ORDER BY kcu.ordinal_position)
    INTO pk_name, pk_cols
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON kcu.constraint_name = tc.constraint_name
     AND kcu.constraint_schema = tc.constraint_schema
     AND kcu.table_name = tc.table_name
   WHERE tc.table_schema = 'public'
     AND tc.table_name = 'orders'
     AND tc.constraint_type = 'PRIMARY KEY'
   GROUP BY tc.constraint_name;

  IF pk_name IS NOT NULL AND pk_cols <> ARRAY['id'] THEN
    EXECUTE format('ALTER TABLE public.orders DROP CONSTRAINT %I', pk_name);
    pk_name := NULL;
  END IF;
  IF pk_name IS NULL THEN
    ALTER TABLE public.orders ADD CONSTRAINT orders_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'vendors'
       AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.vendors ADD CONSTRAINT vendors_pkey PRIMARY KEY (id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.table_constraints
     WHERE table_schema = 'public'
       AND table_name = 'customers'
       AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE public.customers ADD CONSTRAINT customers_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- ------------------------------------------------------------------
-- Admin update policies
--
-- The admin console can already read every marketplace row, but
-- customers, products, and orders only had owner-scoped UPDATE
-- policies. Those PATCH requests return 200 [] (no matching rows),
-- which looks like a silent failure in the dashboard.
-- ------------------------------------------------------------------

DROP POLICY IF EXISTS "Admins can update vendors" ON public.vendors;
CREATE POLICY "Admins can update vendors" ON public.vendors
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update customers" ON public.customers;
CREATE POLICY "Admins can update customers" ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products" ON public.products
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
CREATE POLICY "Admins can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- The admin may need to remove abusive or test accounts entirely.
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products" ON public.products
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- The order status column grant from 20261028000001 is still the only
-- column authenticated users may write. The admin policy above widens
-- which rows an admin can change, not which columns.

-- ------------------------------------------------------------------
-- Storage: public site-media bucket
--
-- Paths are namespaced by auth uid:
--   <uid>/products/<file>.jpg
--   <uid>/stores/<file>.jpg
--   <uid>/avatars/<file>.jpg
-- Admins may manage any object in the bucket.
-- ------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'site-media',
  'site-media',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Site media is publicly readable" ON storage.objects;
CREATE POLICY "Site media is publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-media');

DROP POLICY IF EXISTS "Users can upload their own site media" ON storage.objects;
CREATE POLICY "Users can upload their own site media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'site-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users can update their own site media" ON storage.objects;
CREATE POLICY "Users can update their own site media"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'site-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  )
  WITH CHECK (
    bucket_id = 'site-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "Users can delete their own site media" ON storage.objects;
CREATE POLICY "Users can delete their own site media"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'site-media'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.is_admin()
    )
  );
