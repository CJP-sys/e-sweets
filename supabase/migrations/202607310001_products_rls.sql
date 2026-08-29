-- Public storefront access: anyone may read catalog products.
-- No INSERT, UPDATE, or DELETE policies are created, so browser clients cannot
-- modify the catalog. Administrative writes should use a trusted server.

alter table public.products enable row level security;

drop policy if exists "Public can view products" on public.products;

create policy "Public can view products"
on public.products
for select
to anon, authenticated
using (true);
