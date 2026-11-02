-- Public media bucket for product, store, profile, and site images.
-- Uploads are limited to each signed-in user's own folder. Admins may
-- manage every object in the bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-media',
  'site-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Site media is publicly readable" on storage.objects;
create policy "Site media is publicly readable"
on storage.objects for select
using (bucket_id = 'site-media');

drop policy if exists "Users can upload their own site media" on storage.objects;
create policy "Users can upload their own site media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Users can update their own site media" on storage.objects;
create policy "Users can update their own site media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'site-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
)
with check (
  bucket_id = 'site-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);

drop policy if exists "Users can delete their own site media" on storage.objects;
create policy "Users can delete their own site media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'site-media'
  and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
  )
);
