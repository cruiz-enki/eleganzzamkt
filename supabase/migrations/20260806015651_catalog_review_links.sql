create extension if not exists pgcrypto with schema extensions;

create table if not exists public.catalog_review_links (
  id uuid primary key default extensions.gen_random_uuid(),
  token text not null unique default encode(extensions.gen_random_bytes(18), 'hex'),
  title text not null default 'Catalogo de revision',
  client_name text,
  intro_message text,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  expires_at timestamptz,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.catalog_review_marks (
  id uuid primary key default extensions.gen_random_uuid(),
  link_id uuid not null references public.catalog_review_links(id) on delete cascade,
  mueble_id uuid not null references public.muebles(id) on delete cascade,
  requested_action text not null,
  note text,
  suggested_price numeric,
  reviewer_name text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint catalog_review_marks_action_check check (
    requested_action in ('delete', 'change_photo', 'change_price', 'note', 'other')
  ),
  constraint catalog_review_marks_status_check check (
    status in ('open', 'reviewed', 'resolved', 'dismissed')
  )
);

create index if not exists catalog_review_links_token_idx
  on public.catalog_review_links(token);

create index if not exists catalog_review_links_active_idx
  on public.catalog_review_links(is_active, expires_at);

create index if not exists catalog_review_marks_link_idx
  on public.catalog_review_marks(link_id, created_at desc);

create index if not exists catalog_review_marks_mueble_idx
  on public.catalog_review_marks(mueble_id);

alter table public.catalog_review_links enable row level security;
alter table public.catalog_review_marks enable row level security;

drop policy if exists "Admin manage catalog review links" on public.catalog_review_links;
create policy "Admin manage catalog review links"
  on public.catalog_review_links
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

drop policy if exists "Admin manage catalog review marks" on public.catalog_review_marks;
create policy "Admin manage catalog review marks"
  on public.catalog_review_marks
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

grant select, insert, update, delete on public.catalog_review_links to authenticated;
grant select, insert, update, delete on public.catalog_review_marks to authenticated;
revoke all on public.catalog_review_links from anon;
revoke all on public.catalog_review_marks from anon;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists catalog_review_links_touch_updated_at on public.catalog_review_links;
create trigger catalog_review_links_touch_updated_at
  before update on public.catalog_review_links
  for each row
  execute function public.touch_updated_at();

drop trigger if exists catalog_review_marks_touch_updated_at on public.catalog_review_marks;
create trigger catalog_review_marks_touch_updated_at
  before update on public.catalog_review_marks
  for each row
  execute function public.touch_updated_at();

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
      or coalesce(m.detalles ->> 'status', 'draft') in (
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

create or replace function public.submit_catalog_review_mark(
  p_token text,
  p_mueble_id uuid,
  p_requested_action text,
  p_note text default null,
  p_suggested_price numeric default null,
  p_reviewer_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.catalog_review_links%rowtype;
  v_mark public.catalog_review_marks%rowtype;
begin
  if p_requested_action not in ('delete', 'change_photo', 'change_price', 'note', 'other') then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'INVALID_REVIEW_ACTION',
      'message', 'La accion solicitada no es valida.'
    );
  end if;

  select *
    into v_link
  from public.catalog_review_links
  where token = p_token
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

  if not exists (select 1 from public.muebles where id = p_mueble_id) then
    return jsonb_build_object(
      'success', false,
      'errorCode', 'PRODUCT_NOT_FOUND',
      'message', 'No encontramos este producto en el catalogo.'
    );
  end if;

  insert into public.catalog_review_marks (
    link_id,
    mueble_id,
    requested_action,
    note,
    suggested_price,
    reviewer_name
  )
  values (
    v_link.id,
    p_mueble_id,
    p_requested_action,
    nullif(trim(coalesce(p_note, '')), ''),
    p_suggested_price,
    nullif(trim(coalesce(p_reviewer_name, '')), '')
  )
  returning * into v_mark;

  return jsonb_build_object(
    'success', true,
    'mark', jsonb_build_object(
      'id', v_mark.id,
      'requested_action', v_mark.requested_action,
      'status', v_mark.status,
      'created_at', v_mark.created_at
    ),
    'message', 'Solicitud registrada correctamente.'
  );
end;
$$;

revoke all on function public.get_catalog_review(text) from public;
revoke all on function public.submit_catalog_review_mark(text, uuid, text, text, numeric, text) from public;
grant execute on function public.get_catalog_review(text) to anon, authenticated;
grant execute on function public.submit_catalog_review_mark(text, uuid, text, text, numeric, text) to anon, authenticated;
