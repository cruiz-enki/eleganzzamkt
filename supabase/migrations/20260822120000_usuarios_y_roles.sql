-- Gestión de usuarios con roles: admin, editor, lector.
--
-- Hasta ahora las 13 tablas daban acceso TOTAL a cualquier cuenta autenticada,
-- y el único filtro era un correo escrito a mano en AuthGate.tsx. En cuanto
-- exista una segunda cuenta, eso significa que esa persona puede borrar el
-- catálogo. Por eso los permisos se definen aquí, en la base, y no solo
-- escondiendo botones en la interfaz.
--
-- Qué puede cada rol:
--   admin   -> todo, incluye borrar y administrar usuarios
--   editor  -> ver y editar (productos, publicaciones, campañas). NO borra.
--   lector  -> solo ver
--
-- Las server functions usan la llave de servicio, así que no dependen de esto.
-- Los portales por token entran por RPCs security definer: tampoco se afectan.

-- ---------------------------------------------------------------------
-- 1. Perfiles
-- ---------------------------------------------------------------------
create table if not exists public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  nombre text,
  rol text not null default 'lector',
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfiles_rol_check') then
    alter table public.perfiles
      add constraint perfiles_rol_check check (rol in ('admin', 'editor', 'lector'));
  end if;
end $$;

drop trigger if exists perfiles_touch_updated_at on public.perfiles;
create trigger perfiles_touch_updated_at
  before update on public.perfiles
  for each row execute function public.touch_updated_at();

-- El dueño de la cuenta actual queda como admin ANTES de endurecer nada:
-- si no, la migración lo dejaría fuera de su propia plataforma.
insert into public.perfiles (id, email, nombre, rol)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), 'admin'
from auth.users u
on conflict (id) do update set rol = 'admin', activo = true;

-- ---------------------------------------------------------------------
-- 2. Helpers de rol (security definer: leen perfiles sin pelearse con RLS)
-- ---------------------------------------------------------------------
create or replace function public.mi_rol()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.rol
  from public.perfiles p
  where p.id = auth.uid() and p.activo = true
  limit 1;
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.mi_rol() = 'admin', false); $$;

create or replace function public.puede_editar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.mi_rol() in ('admin', 'editor'), false); $$;

create or replace function public.puede_ver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$ select coalesce(public.mi_rol() in ('admin', 'editor', 'lector'), false); $$;

grant execute on function public.mi_rol() to authenticated;
grant execute on function public.es_admin() to authenticated;
grant execute on function public.puede_editar() to authenticated;
grant execute on function public.puede_ver() to authenticated;

-- ---------------------------------------------------------------------
-- 3. RLS de perfiles
-- ---------------------------------------------------------------------
alter table public.perfiles enable row level security;

drop policy if exists "Ver el equipo" on public.perfiles;
create policy "Ver el equipo"
  on public.perfiles for select to authenticated
  using (public.puede_ver() or id = auth.uid());

drop policy if exists "Solo admin administra usuarios" on public.perfiles;
create policy "Solo admin administra usuarios"
  on public.perfiles for all to authenticated
  using (public.es_admin())
  with check (public.es_admin());

revoke all on public.perfiles from anon;
grant select, insert, update, delete on public.perfiles to authenticated;

-- ---------------------------------------------------------------------
-- 4. Las tablas de trabajo pasan a permisos por rol
-- ---------------------------------------------------------------------
do $$
declare
  tablas text[] := array[
    'muebles', 'catalogos', 'campanas', 'mueble_assets', 'review_comments',
    'campana_muebles', 'campana_assets', 'catalog_review_links',
    'catalog_review_marks', 'woocommerce_sync_jobs', 'woocommerce_sync_history',
    'publicaciones', 'publicacion_comentarios'
  ];
  t text;
  p record;
begin
  foreach t in array tablas loop
    -- Se quitan las políticas anteriores (nombres heredados, varían por tabla).
    for p in
      select policyname from pg_policies where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "Ver segun rol" on public.%I for select to authenticated using (public.puede_ver())', t);
    execute format(
      'create policy "Crear segun rol" on public.%I for insert to authenticated with check (public.puede_editar())', t);
    execute format(
      'create policy "Editar segun rol" on public.%I for update to authenticated using (public.puede_editar()) with check (public.puede_editar())', t);
    execute format(
      'create policy "Borrar solo admin" on public.%I for delete to authenticated using (public.es_admin())', t);
  end loop;
end $$;
