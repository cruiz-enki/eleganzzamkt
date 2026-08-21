-- Cierra el acceso del rol `anon` a las tablas del catálogo.
--
-- Antes de esta migración, cualquiera con la llave pública (que viaja en el
-- bundle del navegador) podía LEER y ESCRIBIR `muebles`, `catalogos` y
-- `campanas`. Estaba así porque las server functions corrían como `anon`.
--
-- Requisito previo: las server functions ya usan SUPABASE_SERVICE_ROLE_KEY
-- (ver src/lib/supabase-admin.ts). Aplicar esta migración ANTES de configurar
-- esa variable dejaría la app sin acceso a los datos.
--
-- El portal público por token no se ve afectado: entra por RPCs `security
-- definer` (get_catalog_review, get_catalog_review_product, etc.), que no
-- dependen de estas políticas.

-- muebles ---------------------------------------------------------------
alter table public.muebles enable row level security;

drop policy if exists "Permitir edición total" on public.muebles;
drop policy if exists "Permitir lectura pública" on public.muebles;
drop policy if exists "Permitir lectura pública a todos" on public.muebles;

drop policy if exists "Solo usuarios autenticados pueden editar" on public.muebles;
create policy "Solo usuarios autenticados pueden editar"
  on public.muebles
  for all
  to authenticated
  using (true)
  with check (true);

-- catalogos -------------------------------------------------------------
alter table public.catalogos enable row level security;

drop policy if exists "Allow all" on public.catalogos;

drop policy if exists "Admin manage catalogos" on public.catalogos;
create policy "Admin manage catalogos"
  on public.catalogos
  for all
  to authenticated
  using (true)
  with check (true);

-- campanas --------------------------------------------------------------
alter table public.campanas enable row level security;

drop policy if exists "Acceso total" on public.campanas;

drop policy if exists "Admin manage campanas" on public.campanas;
create policy "Admin manage campanas"
  on public.campanas
  for all
  to authenticated
  using (true)
  with check (true);
