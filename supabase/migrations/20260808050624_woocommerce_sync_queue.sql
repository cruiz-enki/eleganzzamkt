create table if not exists public.woocommerce_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.muebles(id) on delete cascade,
  action text not null default 'upsert',
  status text not null default 'pending',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  last_error text,
  result jsonb,
  constraint woocommerce_sync_jobs_action_check check (action in ('upsert')),
  constraint woocommerce_sync_jobs_status_check check (
    status in ('pending', 'running', 'synced', 'failed', 'canceled')
  ),
  constraint woocommerce_sync_jobs_attempts_check check (attempts >= 0),
  constraint woocommerce_sync_jobs_max_attempts_check check (max_attempts between 1 and 10)
);

create index if not exists woocommerce_sync_jobs_status_requested_at_idx
  on public.woocommerce_sync_jobs (status, requested_at asc);

create index if not exists woocommerce_sync_jobs_product_id_idx
  on public.woocommerce_sync_jobs (product_id);

create unique index if not exists woocommerce_sync_jobs_one_active_per_product_idx
  on public.woocommerce_sync_jobs (product_id)
  where status in ('pending', 'running');

create or replace function public.set_woocommerce_sync_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_woocommerce_sync_jobs_updated_at
  on public.woocommerce_sync_jobs;

create trigger set_woocommerce_sync_jobs_updated_at
before update on public.woocommerce_sync_jobs
for each row
execute function public.set_woocommerce_sync_jobs_updated_at();

alter table public.woocommerce_sync_jobs enable row level security;

grant select, insert, update, delete on public.woocommerce_sync_jobs to authenticated;

create policy "Admin users can manage WooCommerce sync jobs"
on public.woocommerce_sync_jobs
for all
to authenticated
using (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'administrator')
  or (auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin', 'administrator']
)
with check (
  coalesce((auth.jwt() -> 'app_metadata' ->> 'role'), '') in ('admin', 'administrator')
  or (auth.jwt() -> 'app_metadata' -> 'roles') ?| array['admin', 'administrator']
);
