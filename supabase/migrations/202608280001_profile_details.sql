-- Add the profile details collected by account.html.
alter table public.profiles
  add column if not exists username text,
  add column if not exists phone text,
  add column if not exists gender text,
  add column if not exists birth_date date,
  add column if not exists avatar_url text;

revoke update on public.profiles from authenticated;
grant update (full_name, username, phone, gender, birth_date, avatar_url, updated_at)
  on public.profiles to authenticated;

-- Create this bucket as public, or replace getPublicUrl with signed URLs
-- when the bucket is private.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "Users can upload their avatar" on storage.objects;
create policy "Users can upload their avatar"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update their avatar" on storage.objects;
create policy "Users can update their avatar"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Anyone can view avatars" on storage.objects;
create policy "Anyone can view avatars"
on storage.objects for select
to public
using (bucket_id = 'avatars');