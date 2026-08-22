-- Notificaciones dentro de la app.
--
-- El evento que más falta hace: hoy, cuando Eleganzza autoriza o rechaza algo
-- desde su enlace, nadie se entera hasta que alguien entra a mirar.
--
-- Se guarda UNA fila por persona (no una global con lista de leídos): con un
-- equipo chico es más simple y deja que cada quien marque las suyas.

create table if not exists public.notificaciones (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.perfiles(id) on delete cascade,
  tipo text not null,
  titulo text not null,
  mensaje text,
  seccion text,
  referencia_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  leida_at timestamptz,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notificaciones_tipo_check') then
    alter table public.notificaciones
      add constraint notificaciones_tipo_check
      check (tipo in ('decision_cliente', 'marca_catalogo', 'falla_tecnica', 'proceso'));
  end if;
end $$;

create index if not exists notificaciones_usuario_idx
  on public.notificaciones(usuario_id, leida_at, created_at desc);

alter table public.notificaciones enable row level security;

-- Cada quien ve y marca solo las suyas.
drop policy if exists "Ver mis notificaciones" on public.notificaciones;
create policy "Ver mis notificaciones"
  on public.notificaciones for select to authenticated
  using (usuario_id = auth.uid());

drop policy if exists "Marcar mis notificaciones" on public.notificaciones;
create policy "Marcar mis notificaciones"
  on public.notificaciones for update to authenticated
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

revoke all on public.notificaciones from anon;
grant select, update on public.notificaciones to authenticated;

-- ---------------------------------------------------------------------
-- Crear una notificación para todo el equipo activo.
-- security definer: la llaman las RPCs del portal, donde quien entra es anon.
-- ---------------------------------------------------------------------
create or replace function public.crear_notificacion(
  p_tipo text,
  p_titulo text,
  p_mensaje text default null,
  p_seccion text default null,
  p_referencia_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creadas integer;
begin
  insert into public.notificaciones (usuario_id, tipo, titulo, mensaje, seccion, referencia_id, metadata)
  select p.id, p_tipo, p_titulo, p_mensaje, p_seccion, p_referencia_id, coalesce(p_metadata, '{}'::jsonb)
  from public.perfiles p
  where p.activo = true;

  get diagnostics v_creadas = row_count;
  return v_creadas;
end;
$$;

revoke all on function public.crear_notificacion(text, text, text, text, uuid, jsonb) from public;
grant execute on function public.crear_notificacion(text, text, text, text, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- Disparador 1: decisiones del cliente sobre publicaciones.
-- Misma función de 20260820230000, con el aviso agregado al final.
-- ---------------------------------------------------------------------
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
  v_titulo text;
  v_quien text;
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

  select estado, titulo into v_estado_actual, v_titulo
  from public.publicaciones
  where id = p_publicacion_id;

  if v_estado_actual is null then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACION_NO_ENCONTRADA',
      'message', 'La publicacion no existe.'
    );
  end if;

  if v_estado_actual = 'borrador' then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PUBLICACION_EN_BORRADOR',
      'message', 'Esta publicacion aun no esta lista para revision.'
    );
  end if;

  if p_decision = 'cambios_solicitados'
     and coalesce(btrim(p_comentario), '') = '' then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'COMENTARIO_REQUERIDO',
      'message', 'Escribe que hay que cambiar.'
    );
  end if;

  update public.publicaciones
  set estado = p_decision,
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

  v_quien := coalesce(nullif(btrim(coalesce(p_reviewer_name, '')), ''), coalesce(v_link.client_name, 'El cliente'));

  perform public.crear_notificacion(
    'decision_cliente',
    case p_decision
      when 'aprobada' then v_quien || ' autorizó una publicación'
      when 'cambios_solicitados' then v_quien || ' pidió cambios en una publicación'
      else v_quien || ' rechazó una publicación'
    end,
    v_titulo || coalesce(': ' || nullif(btrim(coalesce(p_comentario, '')), ''), ''),
    'publicaciones',
    p_publicacion_id
  );

  return jsonb_build_object('success', true, 'estado', p_decision);
end;
$$;

revoke all on function public.set_publicacion_decision(text, uuid, text, text, text) from public;
grant execute on function public.set_publicacion_decision(text, uuid, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Disparador 2: marcas del cliente en el portal del catálogo.
-- Se agrega por trigger para no reescribir la RPC completa.
-- ---------------------------------------------------------------------
create or replace function public.notificar_marca_catalogo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_producto text;
  v_accion text;
begin
  select nombre into v_producto from public.muebles where id = new.mueble_id;

  v_accion := case new.requested_action
    when 'delete' then 'pidió eliminar'
    when 'change_photo' then 'pidió cambiar la foto de'
    when 'change_price' then 'pidió cambiar el precio de'
    when 'note' then 'dejó una nota sobre'
    else 'marcó'
  end;

  perform public.crear_notificacion(
    'marca_catalogo',
    coalesce(nullif(btrim(coalesce(new.reviewer_name, '')), ''), 'El cliente') || ' ' || v_accion || ' ' || coalesce(v_producto, 'un producto'),
    nullif(btrim(coalesce(new.note, '')), ''),
    'productos',
    new.mueble_id
  );

  return new;
end;
$$;

drop trigger if exists catalog_review_marks_notifica on public.catalog_review_marks;
create trigger catalog_review_marks_notifica
  after insert on public.catalog_review_marks
  for each row execute function public.notificar_marca_catalogo();
