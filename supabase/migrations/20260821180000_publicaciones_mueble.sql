-- Liga una publicación con el mueble del que habla.
--
-- Sirve para dos cosas: mostrar las publicaciones dentro de la ficha del
-- producto, y guardar sus archivos en la carpeta de Drive de ese mueble
-- (en una subcarpeta "Publicaciones", para que las artes de redes no se
-- cuelen en la galería de fotos del producto).

alter table public.publicaciones
  add column if not exists mueble_id uuid references public.muebles(id) on delete set null;

create index if not exists publicaciones_mueble_idx on public.publicaciones(mueble_id);
