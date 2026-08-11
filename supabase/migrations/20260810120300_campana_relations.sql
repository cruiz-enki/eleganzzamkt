-- =====================================================================
-- FASE 7 — Relaciones campaña ↔ mueble y campaña ↔ asset
-- =====================================================================
-- Tablas de unión para conectar campañas con productos fuente y assets usados,
-- de modo que una campaña sea rastreable hasta el producto y su aprobación.
-- `campanas` ya existe; aquí solo agregamos relaciones (aditivo).

create table if not exists public.campana_muebles (
  campana_id uuid not null references public.campanas(id) on delete cascade,
  mueble_id uuid not null references public.muebles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campana_id, mueble_id)
);

create table if not exists public.campana_assets (
  campana_id uuid not null references public.campanas(id) on delete cascade,
  asset_id uuid not null references public.mueble_assets(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (campana_id, asset_id)
);

create index if not exists campana_muebles_mueble_idx on public.campana_muebles(mueble_id);
create index if not exists campana_assets_asset_idx on public.campana_assets(asset_id);

alter table public.campana_muebles enable row level security;
alter table public.campana_assets enable row level security;

drop policy if exists "Admin manage campana muebles" on public.campana_muebles;
create policy "Admin manage campana muebles"
  on public.campana_muebles
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

drop policy if exists "Admin manage campana assets" on public.campana_assets;
create policy "Admin manage campana assets"
  on public.campana_assets
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

grant select, insert, update, delete on public.campana_muebles to authenticated;
grant select, insert, update, delete on public.campana_assets to authenticated;
revoke all on public.campana_muebles from anon;
revoke all on public.campana_assets from anon;
