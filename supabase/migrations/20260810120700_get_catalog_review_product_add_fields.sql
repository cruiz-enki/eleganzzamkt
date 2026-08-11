-- =====================================================================
-- Actualiza get_catalog_review_product para incluir marca/materiales/colores/medidas
-- =====================================================================
-- CREATE OR REPLACE (idempotente). Mantiene la misma firma y seguridad.

create or replace function public.get_catalog_review_product(p_token text, p_mueble_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_product jsonb;
begin
  v_link := public.catalog_review_link_by_token(p_token);
  if v_link.id is null then
    return jsonb_build_object('success', false, 'errorCode', 'CATALOG_REVIEW_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.');
  end if;

  if not public.catalog_review_scope_ok(coalesce(v_link.filters, '{}'::jsonb), p_mueble_id) then
    return jsonb_build_object('success', false, 'errorCode', 'PRODUCT_OUT_OF_SCOPE',
      'message', 'Este producto no forma parte de este enlace de revision.');
  end if;

  select jsonb_build_object(
    'id', m.id, 'nombre', m.nombre, 'sku', m.sku, 'categoria', m.categoria,
    'descripcion', m.descripcion, 'precio', m.precio, 'precio_2', m.precio_2, 'precio_3', m.precio_3,
    'marca', m.marca, 'materiales', m.materiales, 'colores', m.colores, 'medidas', m.medidas,
    'detalles', m.detalles, 'fotos', m.fotos, 'galeria', m.galeria,
    'estado_verificacion', m.estado_verificacion,
    'verificado_por', m.verificado_por, 'verificado_at', m.verificado_at,
    'observaciones', m.observaciones,
    'assets', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', a.id, 'tipo', a.tipo, 'url', a.url, 'drive_file_id', a.drive_file_id,
        'nombre_archivo', a.nombre_archivo, 'origen', a.origen, 'descripcion', a.descripcion,
        'es_principal', a.es_principal, 'estado_revision', a.estado_revision,
        'aprobada_por', a.aprobada_por, 'aprobada_at', a.aprobada_at, 'notas', a.notas,
        'created_at', a.created_at
      ) order by a.es_principal desc, a.created_at desc), '[]'::jsonb)
      from public.mueble_assets a where a.mueble_id = m.id
    ),
    'comments', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'asset_id', c.asset_id, 'autor', c.autor, 'mensaje', c.mensaje,
        'tipo', c.tipo, 'created_at', c.created_at
      ) order by c.created_at desc), '[]'::jsonb)
      from public.review_comments c where c.mueble_id = m.id
    )
  )
  into v_product
  from public.muebles m
  where m.id = p_mueble_id;

  return jsonb_build_object('success', true, 'product', v_product);
end;
$$;
