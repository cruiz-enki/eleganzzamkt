-- =====================================================================
-- FASE 1 — Ficha maestra del producto: campos de verificación/trazabilidad
-- =====================================================================
-- Aditivo y reversible. NO borra, renombra ni modifica datos existentes.
-- Los datos flexibles (medidas, materiales, colores, disponibilidad) siguen
-- viviendo en `muebles.detalles` (jsonb) para no duplicar columnas.
-- La lógica de "listo para marketing/ecommerce" NO se guarda aquí: se deriva
-- con helpers centralizados (ver src/lib/domain/editorial-rules.ts).

alter table public.muebles add column if not exists sku text;
alter table public.muebles add column if not exists estado_verificacion text not null default 'por_verificar';
alter table public.muebles add column if not exists verificado_por text;
alter table public.muebles add column if not exists verificado_at timestamptz;
alter table public.muebles add column if not exists observaciones text;
alter table public.muebles add column if not exists estado_marketing text not null default 'pendiente';
alter table public.muebles add column if not exists estado_ecommerce text not null default 'pendiente';
-- FK a la foto principal (mueble_assets). La constraint se agrega en la
-- migración de mueble_assets, cuando la tabla destino ya existe.
alter table public.muebles add column if not exists foto_principal_asset_id uuid;

-- Estados de verificación permitidos: incompleto | por_verificar | verificado | rechazado
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'muebles_estado_verificacion_check'
  ) then
    alter table public.muebles
      add constraint muebles_estado_verificacion_check
      check (estado_verificacion in ('incompleto', 'por_verificar', 'verificado', 'rechazado'));
  end if;
end$$;

create index if not exists muebles_estado_verificacion_idx on public.muebles(estado_verificacion);
create index if not exists muebles_sku_idx on public.muebles(sku);

-- Mantener updated_at al día (la función touch_updated_at ya existe en la BD).
drop trigger if exists muebles_touch_updated_at on public.muebles;
create trigger muebles_touch_updated_at
  before update on public.muebles
  for each row execute function public.touch_updated_at();
