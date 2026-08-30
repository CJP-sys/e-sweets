-- Supabase Auth profiles and two-role authorization model.
-- Roles are limited to customer and owner. Browser users cannot change roles.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role text not null default 'customer' check (role in ('customer', 'owner')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'customer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Backfill profiles for accounts created before this migration.
insert into public.profiles (id, email, full_name, role, created_at)
select
  id,
  coalesce(email, ''),
  coalesce(raw_user_meta_data ->> 'full_name', ''),
  'customer',
  created_at
from auth.users
on conflict (id) do nothing;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'owner'
  );
$$;

revoke all on function public.is_owner() from public;
grant execute on function public.is_owner() to authenticated;

drop policy if exists "Customers can read their profile" on public.profiles;
create policy "Customers can read their profile"
on public.profiles for select
to authenticated
using (id = auth.uid());

drop policy if exists "Owners can read all profiles" on public.profiles;
create policy "Owners can read all profiles"
on public.profiles for select
to authenticated
using (public.is_owner());

drop policy if exists "Customers can update their profile" on public.profiles;
create policy "Customers can update their profile"
on public.profiles for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

grant select on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (full_name, username, phone, gender, birth_date, avatar_url, updated_at) on public.profiles to authenticated;

-- Promote exactly one existing account from the Supabase SQL editor by
-- replacing the email below. Never expose a service-role key in browser code.
-- update public.profiles set role = 'owner' where email = 'owner@example.com';
