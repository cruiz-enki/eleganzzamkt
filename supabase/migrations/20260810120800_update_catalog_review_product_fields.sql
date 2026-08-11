-- =====================================================================
-- RPC: permitir que el portal (token) llene datos faltantes del producto
-- =====================================================================
-- security definer + token-scoped. Solo ACTUALIZA campos descriptivos.
-- No borra: si el campo llega vacío, se conserva el valor existente
-- (coalesce), así el revisor solo puede agregar/corregir, no vaciar.

create or replace function public.update_catalog_review_product_fields(
  p_token text,
  p_mueble_id uuid,
  p_marca text default null,
  p_materiales text default null,
  p_colores text default null,
  p_medidas text default null,
  p_descripcion text default null,
  p_reviewer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
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

  update public.muebles
  set
    marca = coalesce(nullif(trim(coalesce(p_marca, '')), ''), marca),
    materiales = coalesce(nullif(trim(coalesce(p_materiales, '')), ''), materiales),
    colores = coalesce(nullif(trim(coalesce(p_colores, '')), ''), colores),
    medidas = coalesce(nullif(trim(coalesce(p_medidas, '')), ''), medidas),
    descripcion = coalesce(nullif(trim(coalesce(p_descripcion, '')), ''), descripcion)
  where id = p_mueble_id;

  insert into public.review_comments (mueble_id, review_link_id, autor, mensaje, tipo)
  values (
    p_mueble_id, v_link.id, nullif(trim(coalesce(p_reviewer_name, '')), ''),
    'Eleganzza actualizo datos del producto (marca/materiales/colores/medidas/descripcion).',
    'sistema'
  );

  return jsonb_build_object('success', true, 'message', 'Datos actualizados.');
end;
$$;

revoke all on function public.update_catalog_review_product_fields(text, uuid, text, text, text, text, text, text) from public;
grant execute on function public.update_catalog_review_product_fields(text, uuid, text, text, text, text, text, text) to anon, authenticated;
