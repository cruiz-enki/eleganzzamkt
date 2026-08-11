-- =====================================================================
-- FASE 4 — review_comments: comentarios/trazabilidad ligados a producto y/o asset
-- =====================================================================
-- Capa NUEVA que convive con `catalog_review_marks` (NO se elimina ni se toca).
-- Un comentario puede apuntar a un mueble, a un asset, o a ambos, y opcionalmente
-- referenciar el enlace de revisión por el que se originó (trazabilidad).

create table if not exists public.review_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  mueble_id uuid references public.muebles(id) on delete cascade,
  asset_id uuid references public.mueble_assets(id) on delete cascade,
  review_link_id uuid references public.catalog_review_links(id) on delete set null,
  autor text,
  mensaje text not null,
  tipo text not null default 'comentario',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  constraint review_comments_tipo_check check (
    tipo in ('comentario', 'aprobacion', 'rechazo', 'cambio_solicitado', 'verificacion', 'sistema')
  ),
  constraint review_comments_target_check check (
    mueble_id is not null or asset_id is not null
  )
);

create index if not exists review_comments_mueble_idx on public.review_comments(mueble_id, created_at desc);
create index if not exists review_comments_asset_idx on public.review_comments(asset_id, created_at desc);
create index if not exists review_comments_link_idx on public.review_comments(review_link_id);

alter table public.review_comments enable row level security;

drop policy if exists "Admin manage review comments" on public.review_comments;
create policy "Admin manage review comments"
  on public.review_comments
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

grant select, insert, update, delete on public.review_comments to authenticated;
revoke all on public.review_comments from anon;
