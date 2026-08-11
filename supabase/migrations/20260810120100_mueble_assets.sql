-- =====================================================================
-- FASE 2 — mueble_assets: rastrea TODAS las imágenes/archivos por mueble
-- (+ FASE 11: campos preparados para auditoría IA, sin construir CV todavía)
-- =====================================================================
-- Cada asset se ancla a un mueble (FK). El portal público por token NO accede
-- directo a esta tabla: lo hace vía funciones security definer (ver migración
-- de RPCs). RLS restringe la tabla al admin autenticado.

create table if not exists public.mueble_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  mueble_id uuid not null references public.muebles(id) on delete cascade,
  tipo text not null default 'otro',
  url text,
  drive_file_id text,
  nombre_archivo text,
  origen text,
  descripcion text,
  es_principal boolean not null default false,
  estado_revision text not null default 'pendiente',
  aprobada_por text,
  aprobada_at timestamptz,
  notas text,
  metadata jsonb not null default '{}'::jsonb,
  -- FASE 11: preparado para validación IA futura (no se calcula todavía)
  ai_validation_status text,
  ai_validation_score numeric,
  ai_validation_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint mueble_assets_tipo_check check (
    tipo in ('catalogo', 'original', 'foto_real', 'editada', 'ia', 'ecommerce', 'campana', 'otro')
  ),
  constraint mueble_assets_estado_revision_check check (
    estado_revision in ('pendiente', 'aprobada', 'rechazada', 'cambios_solicitados')
  )
);

create index if not exists mueble_assets_mueble_idx on public.mueble_assets(mueble_id, created_at desc);
create index if not exists mueble_assets_tipo_idx on public.mueble_assets(mueble_id, tipo);
create index if not exists mueble_assets_estado_idx on public.mueble_assets(estado_revision);

-- Ahora que existe la tabla, agregar la FK de la foto principal en muebles.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'muebles_foto_principal_asset_fk') then
    alter table public.muebles
      add constraint muebles_foto_principal_asset_fk
      foreign key (foto_principal_asset_id) references public.mueble_assets(id) on delete set null;
  end if;
end$$;

alter table public.mueble_assets enable row level security;

drop policy if exists "Admin manage mueble assets" on public.mueble_assets;
create policy "Admin manage mueble assets"
  on public.mueble_assets
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

grant select, insert, update, delete on public.mueble_assets to authenticated;
revoke all on public.mueble_assets from anon;

drop trigger if exists mueble_assets_touch_updated_at on public.mueble_assets;
create trigger mueble_assets_touch_updated_at
  before update on public.mueble_assets
  for each row execute function public.touch_updated_at();
