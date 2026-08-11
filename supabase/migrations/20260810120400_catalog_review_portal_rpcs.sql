-- =====================================================================
-- FASE 3/4/5/12 — RPCs del portal de revisión por token (security definer)
-- =====================================================================
-- Extiende el patrón existente (get_catalog_review / submit_catalog_review_mark).
-- El rol `anon` NO toca tablas: solo ejecuta estas funciones, que:
--   * validan el token (activo y no expirado) server-side,
--   * verifican que el mueble/asset esté dentro del SCOPE del enlace (filtros),
--   * dejan trazabilidad en review_comments.
-- No confiar en el frontend para autorización.

-- Helper: ¿el mueble está dentro del scope (filtros) del enlace?
create or replace function public.catalog_review_scope_ok(p_filters jsonb, p_mueble_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.muebles m
    where m.id = p_mueble_id
      and (
        not (p_filters ? 'categories')
        or jsonb_array_length(coalesce(p_filters -> 'categories', '[]'::jsonb)) = 0
        or m.categoria in (
          select jsonb_array_elements_text(coalesce(p_filters -> 'categories', '[]'::jsonb))
        )
      )
      and (
        not (p_filters ? 'statuses')
        or jsonb_array_length(coalesce(p_filters -> 'statuses', '[]'::jsonb)) = 0
        or coalesce(m.detalles ->> 'status', 'published') in (
          select jsonb_array_elements_text(coalesce(p_filters -> 'statuses', '[]'::jsonb))
        )
      )
      and (
        not (p_filters ? 'productIds')
        or jsonb_array_length(coalesce(p_filters -> 'productIds', '[]'::jsonb)) = 0
        or m.id::text in (
          select jsonb_array_elements_text(coalesce(p_filters -> 'productIds', '[]'::jsonb))
        )
      )
  );
$$;

-- Helper interno: resuelve un enlace válido a partir del token, o null.
create or replace function public.catalog_review_link_by_token(p_token text)
returns public.catalog_review_links
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.catalog_review_links
  where token = p_token
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- Detalle de un producto: ficha + assets + comentarios + verificación
-- ---------------------------------------------------------------------
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

-- ---------------------------------------------------------------------
-- Marcar verificación del producto (verificado / rechazado / por_verificar)
-- ---------------------------------------------------------------------
create or replace function public.set_catalog_review_verification(
  p_token text, p_mueble_id uuid, p_estado text,
  p_reviewer_name text default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
begin
  if p_estado not in ('verificado', 'rechazado', 'por_verificar') then
    return jsonb_build_object('success', false, 'errorCode', 'INVALID_STATE',
      'message', 'Estado de verificacion no valido.');
  end if;

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
  set estado_verificacion = p_estado,
      verificado_por = case when p_estado = 'verificado' then nullif(trim(coalesce(p_reviewer_name, '')), '') else verificado_por end,
      verificado_at = case when p_estado = 'verificado' then now() else verificado_at end,
      observaciones = coalesce(nullif(trim(coalesce(p_note, '')), ''), observaciones)
  where id = p_mueble_id;

  insert into public.review_comments (mueble_id, review_link_id, autor, mensaje, tipo)
  values (
    p_mueble_id, v_link.id, nullif(trim(coalesce(p_reviewer_name, '')), ''),
    coalesce(nullif(trim(coalesce(p_note, '')), ''),
      case p_estado when 'verificado' then 'Producto verificado por Eleganzza.'
                    when 'rechazado' then 'Producto rechazado por Eleganzza.'
                    else 'Producto marcado como por verificar.' end),
    case p_estado when 'verificado' then 'verificacion'
                  when 'rechazado' then 'rechazo' else 'cambio_solicitado' end
  );

  return jsonb_build_object('success', true, 'message', 'Verificacion registrada.');
end;
$$;

-- ---------------------------------------------------------------------
-- Decisión sobre un asset (aprobar / rechazar / solicitar cambios)
-- ---------------------------------------------------------------------
create or replace function public.set_catalog_asset_decision(
  p_token text, p_asset_id uuid, p_decision text,
  p_reviewer_name text default null, p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_mueble_id uuid;
  v_estado text;
begin
  if p_decision not in ('aprobada', 'rechazada', 'cambios_solicitados') then
    return jsonb_build_object('success', false, 'errorCode', 'INVALID_DECISION',
      'message', 'Decision no valida.');
  end if;

  v_link := public.catalog_review_link_by_token(p_token);
  if v_link.id is null then
    return jsonb_build_object('success', false, 'errorCode', 'CATALOG_REVIEW_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.');
  end if;

  select mueble_id into v_mueble_id from public.mueble_assets where id = p_asset_id;
  if v_mueble_id is null then
    return jsonb_build_object('success', false, 'errorCode', 'ASSET_NOT_FOUND',
      'message', 'No encontramos esta imagen.');
  end if;
  if not public.catalog_review_scope_ok(coalesce(v_link.filters, '{}'::jsonb), v_mueble_id) then
    return jsonb_build_object('success', false, 'errorCode', 'ASSET_OUT_OF_SCOPE',
      'message', 'Esta imagen no forma parte de este enlace de revision.');
  end if;

  update public.mueble_assets
  set estado_revision = p_decision,
      aprobada_por = case when p_decision = 'aprobada' then nullif(trim(coalesce(p_reviewer_name, '')), '') else aprobada_por end,
      aprobada_at = case when p_decision = 'aprobada' then now() else aprobada_at end,
      notas = coalesce(nullif(trim(coalesce(p_note, '')), ''), notas)
  where id = p_asset_id;

  insert into public.review_comments (mueble_id, asset_id, review_link_id, autor, mensaje, tipo)
  values (
    v_mueble_id, p_asset_id, v_link.id, nullif(trim(coalesce(p_reviewer_name, '')), ''),
    coalesce(nullif(trim(coalesce(p_note, '')), ''),
      case p_decision when 'aprobada' then 'Imagen aprobada.'
                      when 'rechazada' then 'Imagen rechazada.'
                      else 'Se solicitaron cambios en la imagen.' end),
    case p_decision when 'aprobada' then 'aprobacion'
                    when 'rechazada' then 'rechazo' else 'cambio_solicitado' end
  );

  return jsonb_build_object('success', true, 'message', 'Decision registrada.');
end;
$$;

-- ---------------------------------------------------------------------
-- Comentario libre sobre producto y/o asset
-- ---------------------------------------------------------------------
create or replace function public.add_catalog_review_comment(
  p_token text, p_mueble_id uuid, p_asset_id uuid,
  p_autor text, p_mensaje text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
begin
  if nullif(trim(coalesce(p_mensaje, '')), '') is null then
    return jsonb_build_object('success', false, 'errorCode', 'EMPTY_MESSAGE',
      'message', 'El comentario no puede estar vacio.');
  end if;

  v_link := public.catalog_review_link_by_token(p_token);
  if v_link.id is null then
    return jsonb_build_object('success', false, 'errorCode', 'CATALOG_REVIEW_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.');
  end if;
  if p_mueble_id is null or not public.catalog_review_scope_ok(coalesce(v_link.filters, '{}'::jsonb), p_mueble_id) then
    return jsonb_build_object('success', false, 'errorCode', 'PRODUCT_OUT_OF_SCOPE',
      'message', 'Este producto no forma parte de este enlace de revision.');
  end if;

  insert into public.review_comments (mueble_id, asset_id, review_link_id, autor, mensaje, tipo)
  values (
    p_mueble_id, p_asset_id, v_link.id,
    nullif(trim(coalesce(p_autor, '')), ''),
    left(trim(p_mensaje), 2000),
    'comentario'
  );

  return jsonb_build_object('success', true, 'message', 'Comentario registrado.');
end;
$$;

-- ---------------------------------------------------------------------
-- Registrar una foto subida por Eleganzza (tipo=foto_real, pendiente)
-- El archivo se sube antes desde una server function con credenciales del
-- servidor (Drive/Storage). Aqui solo se registra el asset ya almacenado.
-- ---------------------------------------------------------------------
create or replace function public.register_catalog_review_asset(
  p_token text, p_mueble_id uuid, p_url text, p_drive_file_id text,
  p_nombre_archivo text, p_reviewer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_asset_id uuid;
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
  if coalesce(nullif(trim(coalesce(p_url, '')), ''), p_drive_file_id) is null then
    return jsonb_build_object('success', false, 'errorCode', 'MISSING_FILE',
      'message', 'Falta la referencia del archivo.');
  end if;

  insert into public.mueble_assets (
    mueble_id, tipo, url, drive_file_id, nombre_archivo, origen, estado_revision, metadata
  ) values (
    p_mueble_id, 'foto_real', nullif(trim(coalesce(p_url, '')), ''), nullif(trim(coalesce(p_drive_file_id, '')), ''),
    nullif(trim(coalesce(p_nombre_archivo, '')), ''), 'portal_eleganzza', 'pendiente',
    jsonb_build_object('review_link_id', v_link.id, 'uploaded_by', nullif(trim(coalesce(p_reviewer_name, '')), ''))
  )
  returning id into v_asset_id;

  insert into public.review_comments (mueble_id, asset_id, review_link_id, autor, mensaje, tipo)
  values (p_mueble_id, v_asset_id, v_link.id, nullif(trim(coalesce(p_reviewer_name, '')), ''),
    'Eleganzza subio una fotografia real nueva.', 'sistema');

  return jsonb_build_object('success', true, 'asset_id', v_asset_id, 'message', 'Fotografia registrada.');
end;
$$;

-- Permisos: revocar de public, otorgar execute solo a anon/authenticated.
revoke all on function public.catalog_review_scope_ok(jsonb, uuid) from public;
revoke all on function public.catalog_review_link_by_token(text) from public;
revoke all on function public.get_catalog_review_product(text, uuid) from public;
revoke all on function public.set_catalog_review_verification(text, uuid, text, text, text) from public;
revoke all on function public.set_catalog_asset_decision(text, uuid, text, text, text) from public;
revoke all on function public.add_catalog_review_comment(text, uuid, uuid, text, text) from public;
revoke all on function public.register_catalog_review_asset(text, uuid, text, text, text, text) from public;

grant execute on function public.get_catalog_review_product(text, uuid) to anon, authenticated;
grant execute on function public.set_catalog_review_verification(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.set_catalog_asset_decision(text, uuid, text, text, text) to anon, authenticated;
grant execute on function public.add_catalog_review_comment(text, uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.register_catalog_review_asset(text, uuid, text, text, text, text) to anon, authenticated;
