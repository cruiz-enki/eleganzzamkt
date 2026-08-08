create table if not exists public.woocommerce_sync_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.muebles(id) on delete cascade,
  job_id uuid references public.woocommerce_sync_jobs(id) on delete set null,
  event_type text not null default 'product_sync',
  status text not null,
  action text,
  changed_by uuid references auth.users(id) on delete set null,
  changed_by_email text,
  woo_product_id integer,
  woo_permalink text,
  category_name text,
  category_id integer,
  regular_price text,
  price_2 text,
  price_3 text,
  changed_fields jsonb not null default '[]'::jsonb,
  payload_summary jsonb not null default '{}'::jsonb,
  image_summary jsonb not null default '{}'::jsonb,
  error_code text,
  error_message text,
  message text not null,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint woocommerce_sync_history_event_type_check check (
    event_type in ('product_sync', 'image_sync')
  ),
  constraint woocommerce_sync_history_status_check check (
    status in ('success', 'failed', 'pending', 'skipped')
  )
);

create index if not exists woocommerce_sync_history_product_synced_at_idx
  on public.woocommerce_sync_history (product_id, synced_at desc);

create index if not exists woocommerce_sync_history_job_id_idx
  on public.woocommerce_sync_history (job_id);

alter table public.woocommerce_sync_history enable row level security;

grant select, insert on public.woocommerce_sync_history to authenticated;

create policy "Admin users can read WooCommerce sync history"
on public.woocommerce_sync_history
for select
to authenticated
using (
  coalesce(((select auth.jwt()) -> 'app_metadata' ->> 'role'), '') in ('admin', 'administrator')
  or coalesce(((select auth.jwt()) -> 'app_metadata' -> 'roles'), '[]'::jsonb)
    ?| array['admin', 'administrator']
);
