-- =====================================================================
-- Ficha maestra — campos descriptivos (marca, materiales, colores, medidas)
-- =====================================================================
-- Aditivo y reversible. Columnas de texto libre para la ficha del producto.

alter table public.muebles add column if not exists marca text;
alter table public.muebles add column if not exists materiales text;
alter table public.muebles add column if not exists colores text;
alter table public.muebles add column if not exists medidas text;

create index if not exists muebles_marca_idx on public.muebles(marca);
