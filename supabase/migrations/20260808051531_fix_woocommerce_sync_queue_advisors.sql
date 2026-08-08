create or replace function public.set_woocommerce_sync_jobs_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop policy if exists "Admin users can manage WooCommerce sync jobs"
on public.woocommerce_sync_jobs;

create policy "Admin users can manage WooCommerce sync jobs"
on public.woocommerce_sync_jobs
for all
to authenticated
using (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') in ('admin', 'administrator')
  or coalesce(((select auth.jwt()) -> 'app_metadata' -> 'roles'), '[]'::jsonb)
    ?| array['admin', 'administrator']
)
with check (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') in ('admin', 'administrator')
  or coalesce(((select auth.jwt()) -> 'app_metadata' -> 'roles'), '[]'::jsonb)
    ?| array['admin', 'administrator']
);
