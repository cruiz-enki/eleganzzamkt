-- Flujo de aprobación de PUBLICACIONES.
--
-- Eleganzza autoriza las publicaciones desde el mismo tipo de enlace por token
-- que ya usa para revisar el catálogo: sin cuenta ni contraseña, revocable y
-- con caducidad. Se reutiliza `catalog_review_links` (con una columna `tipo`)
-- en vez de crear otro sistema de enlaces.
--
-- Al aprobar, la publicación solo cambia de estado: no se publica sola en
-- ninguna red. Eso queda para una segunda etapa.

-- ---------------------------------------------------------------------
-- 1. Los enlaces ahora tienen tipo: catálogo o publicaciones
-- ---------------------------------------------------------------------
alter table public.catalog_review_links
  add column if not exists tipo text not null default 'catalogo';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'catalog_review_links_tipo_check'
  ) then
    alter table public.catalog_review_links
      add constraint catalog_review_links_tipo_check
      check (tipo in ('catalogo', 'publicaciones'));
  end if;
end $$;

-- Un enlace de publicaciones NO debe servir para entrar al catálogo.
-- Todos los enlaces que ya existían quedaron con tipo 'catalogo' por el default.
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
    and tipo = 'catalogo'
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

-- ---------------------------------------------------------------------
-- 2. Publicaciones
-- ---------------------------------------------------------------------
create table if not exists public.publicaciones (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  copy text,
  canal text,
  fecha_programada date,
  campana_id uuid references public.campanas(id) on delete set null,
  archivos jsonb not null default '[]'::jsonb,
  estado text not null default 'borrador',
  aprobada_por text,
  aprobada_at timestamptz,
  notas text,
  detalles jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'publicaciones_estado_check'
  ) then
    alter table public.publicaciones
      add constraint publicaciones_estado_check
      check (
        estado in (
          'borrador',
          'en_revision',
          'aprobada',
          'cambios_solicitados',
          'rechazada',
          'publicada'
        )
      );
  end if;
end $$;

create index if not exists publicaciones_estado_idx on public.publicaciones(estado);
create index if not exists publicaciones_fecha_idx on public.publicaciones(fecha_programada);
create index if not exists publicaciones_campana_idx on public.publicaciones(campana_id);

drop trigger if exists publicaciones_touch_updated_at on public.publicaciones;
create trigger publicaciones_touch_updated_at
  before update on public.publicaciones
  for each row execute function public.touch_updated_at();

alter table public.publicaciones enable row level security;

drop policy if exists "Admin manage publicaciones" on public.publicaciones;
create policy "Admin manage publicaciones"
  on public.publicaciones
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.publicaciones from anon;
grant select, insert, update, delete on public.publicaciones to authenticated;

-- ---------------------------------------------------------------------
-- 3. Comentarios y decisiones (bitácora de la revisión)
-- ---------------------------------------------------------------------
create table if not exists public.publicacion_comentarios (
  id uuid primary key default gen_random_uuid(),
  publicacion_id uuid not null references public.publicaciones(id) on delete cascade,
  review_link_id uuid references public.catalog_review_links(id) on delete set null,
  autor text,
  mensaje text,
  tipo text not null default 'comentario',
  created_at timestamptz not null default now()
);

create index if not exists publicacion_comentarios_pub_idx
  on public.publicacion_comentarios(publicacion_id);

alter table public.publicacion_comentarios enable row level security;

drop policy if exists "Admin manage publicacion comentarios" on public.publicacion_comentarios;
create policy "Admin manage publicacion comentarios"
  on public.publicacion_comentarios
  for all
  to authenticated
  using (true)
  with check (true);

revoke all on public.publicacion_comentarios from anon;
grant select, insert, update, delete on public.publicacion_comentarios to authenticated;

-- ---------------------------------------------------------------------
-- 4. RPCs del portal (security definer): lo único que toca el rol anon
-- ---------------------------------------------------------------------

-- Helper: resuelve un enlace de publicaciones válido a partir del token.
create or replace function public.publicacion_review_link_by_token(p_token text)
returns public.catalog_review_links
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.catalog_review_links
  where token = p_token
    and tipo = 'publicaciones'
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;
$$;

-- Lista de publicaciones que el cliente puede revisar.
-- Solo se muestran las que ya se enviaron a revisión: los borradores no salen.
create or replace function public.get_publicaciones_review(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_publicaciones jsonb;
begin
  v_link := public.publicacion_review_link_by_token(p_token);

  if v_link.id is null then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACIONES_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.'
    );
  end if;

  update public.catalog_review_links
  set last_viewed_at = now()
  where id = v_link.id;

  select coalesce(jsonb_agg(p order by p.orden, p.fecha_programada nulls last, p.created_at), '[]'::jsonb)
    into v_publicaciones
  from (
    select
      jsonb_build_object(
        'id', pub.id,
        'titulo', pub.titulo,
        'copy', pub.copy,
        'canal', pub.canal,
        'fechaProgramada', pub.fecha_programada,
        'archivos', pub.archivos,
        'estado', pub.estado,
        'aprobadaPor', pub.aprobada_por,
        'aprobadaAt', pub.aprobada_at,
        'comentarios', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', c.id,
                'autor', c.autor,
                'mensaje', c.mensaje,
                'tipo', c.tipo,
                'createdAt', c.created_at
              )
              order by c.created_at
            ),
            '[]'::jsonb
          )
          from public.publicacion_comentarios c
          where c.publicacion_id = pub.id
        )
      ) as p,
      case pub.estado when 'en_revision' then 0 else 1 end as orden,
      pub.fecha_programada,
      pub.created_at
    from public.publicaciones pub
    where pub.estado <> 'borrador'
  ) as ordenadas;

  return jsonb_build_object(
    'success', true,
    'link', jsonb_build_object(
      'title', v_link.title,
      'clientName', v_link.client_name,
      'introMessage', v_link.intro_message,
      'expiresAt', v_link.expires_at
    ),
    'publicaciones', v_publicaciones
  );
end;
$$;

-- Decisión del cliente sobre UNA publicación.
create or replace function public.set_publicacion_decision(
  p_token text,
  p_publicacion_id uuid,
  p_decision text,
  p_comentario text default null,
  p_reviewer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_estado_actual text;
  v_nuevo_estado text;
begin
  v_link := public.publicacion_review_link_by_token(p_token);

  if v_link.id is null then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACIONES_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.'
    );
  end if;

  if p_decision not in ('aprobada', 'cambios_solicitados', 'rechazada') then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'DECISION_INVALIDA',
      'message', 'La decision no es valida.'
    );
  end if;

  select estado into v_estado_actual
  from public.publicaciones
  where id = p_publicacion_id;

  if v_estado_actual is null then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACION_NO_ENCONTRADA',
      'message', 'La publicacion no existe.'
    );
  end if;

  -- Un borrador no se puede decidir: todavia no se envio a revision.
  if v_estado_actual = 'borrador' then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACION_EN_BORRADOR',
      'message', 'Esta publicacion aun no esta lista para revision.'
    );
  end if;

  -- Pedir cambios exige decir que cambiar.
  if p_decision = 'cambios_solicitados'
     and coalesce(btrim(p_comentario), '') = '' then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'COMENTARIO_REQUERIDO',
      'message', 'Escribe que hay que cambiar.'
    );
  end if;

  v_nuevo_estado := p_decision;

  update public.publicaciones
  set estado = v_nuevo_estado,
      aprobada_por = case when p_decision = 'aprobada' then nullif(btrim(coalesce(p_reviewer_name, '')), '') else aprobada_por end,
      aprobada_at = case when p_decision = 'aprobada' then now() else aprobada_at end
  where id = p_publicacion_id;

  insert into public.publicacion_comentarios (publicacion_id, review_link_id, autor, mensaje, tipo)
  values (
    p_publicacion_id,
    v_link.id,
    nullif(btrim(coalesce(p_reviewer_name, '')), ''),
    nullif(btrim(coalesce(p_comentario, '')), ''),
    p_decision
  );

  return jsonb_build_object('success', true, 'estado', v_nuevo_estado);
end;
$$;

-- Solo estas dos funciones quedan al alcance del rol anon.
revoke all on function public.publicacion_review_link_by_token(text) from public;
revoke all on function public.get_publicaciones_review(text) from public;
revoke all on function public.set_publicacion_decision(text, uuid, text, text, text) from public;

grant execute on function public.get_publicaciones_review(text) to anon, authenticated;
grant execute on function public.set_publicacion_decision(text, uuid, text, text, text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- 5. La lista del catálogo tambien exige que el enlace sea de tipo catalogo.
-- Es la misma funcion de 20260806015651, con esa unica linea agregada.
-- ---------------------------------------------------------------------
create or replace function public.get_catalog_review(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_filters jsonb;
  v_products jsonb;
begin
  select *
    into v_link
  from public.catalog_review_links
  where token = p_token
    and tipo = 'catalogo'
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if not found then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'CATALOG_REVIEW_LINK_NOT_FOUND',
      'message', 'Este enlace no esta disponible o ya expiro.'
    );
  end if;

  update public.catalog_review_links
  set last_viewed_at = now()
  where id = v_link.id;

  v_filters := coalesce(v_link.filters, '{}'::jsonb);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', m.id,
        'nombre', m.nombre,
        'categoria', m.categoria,
        'precio', m.precio,
        'precio_2', m.precio_2,
        'precio_3', m.precio_3,
        'descripcion', m.descripcion,
        'fotos', m.fotos,
        'galeria', m.galeria,
        'detalles', m.detalles,
        'created_at', m.created_at,
        'marks', (
          select coalesce(
            jsonb_agg(
              jsonb_build_object(
                'id', crm.id,
                'requested_action', crm.requested_action,
                'note', crm.note,
                'suggested_price', crm.suggested_price,
                'reviewer_name', crm.reviewer_name,
                'status', crm.status,
                'created_at', crm.created_at
              )
              order by crm.created_at desc
            ),
            '[]'::jsonb
          )
          from public.catalog_review_marks crm
          where crm.link_id = v_link.id
            and crm.mueble_id = m.id
        )
      )
      order by m.nombre asc
    ),
    '[]'::jsonb
  )
  into v_products
  from public.muebles m
  where (
      not (v_filters ? 'categories')
      or jsonb_array_length(coalesce(v_filters -> 'categories', '[]'::jsonb)) = 0
      or m.categoria in (
        select jsonb_array_elements_text(coalesce(v_filters -> 'categories', '[]'::jsonb))
      )
    )
    and (
      not (v_filters ? 'statuses')
      or jsonb_array_length(coalesce(v_filters -> 'statuses', '[]'::jsonb)) = 0
      or coalesce(m.detalles ->> 'status', 'published') in (
        select jsonb_array_elements_text(coalesce(v_filters -> 'statuses', '[]'::jsonb))
      )
    )
    and (
      not (v_filters ? 'productIds')
      or jsonb_array_length(coalesce(v_filters -> 'productIds', '[]'::jsonb)) = 0
      or m.id::text in (
        select jsonb_array_elements_text(coalesce(v_filters -> 'productIds', '[]'::jsonb))
      )
    );

  return jsonb_build_object(
    'success', true,
    'link', jsonb_build_object(
      'id', v_link.id,
      'title', v_link.title,
      'client_name', v_link.client_name,
      'intro_message', v_link.intro_message,
      'filters', v_link.filters,
      'expires_at', v_link.expires_at,
      'created_at', v_link.created_at
    ),
    'products', v_products
  );
end;
$$;
