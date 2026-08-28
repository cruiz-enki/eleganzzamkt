-- =====================================================================
-- Brand Discovery: recibir respuestas del formulario público en el panel
-- =====================================================================
-- Tabla de respuestas (solo admin lee) + RPC pública para enviar (anon).
-- El formulario es público (/brand-discovery), así que el anon NO toca la
-- tabla: solo ejecuta submit_brand_discovery (security definer).

create table if not exists public.brand_discovery_respuestas (
  id uuid primary key default extensions.gen_random_uuid(),
  nombre text,
  respuestas jsonb not null default '{}'::jsonb,
  texto text,
  created_at timestamptz not null default now()
);

create index if not exists brand_discovery_respuestas_created_idx
  on public.brand_discovery_respuestas(created_at desc);

alter table public.brand_discovery_respuestas enable row level security;

drop policy if exists "Admin read brand discovery" on public.brand_discovery_respuestas;
create policy "Admin read brand discovery"
  on public.brand_discovery_respuestas
  for all
  to authenticated
  using (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx')
  with check (((select auth.jwt()) ->> 'email') = 'cruiz@enkisoluciones.mx');

grant select, delete on public.brand_discovery_respuestas to authenticated;
revoke all on public.brand_discovery_respuestas from anon;

-- Envío público (token no aplica aquí; es un formulario abierto).
create or replace function public.submit_brand_discovery(
  p_nombre text,
  p_respuestas jsonb,
  p_texto text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_respuestas is null
     or jsonb_typeof(p_respuestas) <> 'object'
     or p_respuestas = '{}'::jsonb then
    return jsonb_build_object('success', false, 'message', 'No hay respuestas para enviar.');
  end if;

  insert into public.brand_discovery_respuestas (nombre, respuestas, texto)
  values (
    nullif(trim(coalesce(p_nombre, '')), ''),
    p_respuestas,
    nullif(trim(coalesce(p_texto, '')), '')
  )
  returning id into v_id;

  return jsonb_build_object('success', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_brand_discovery(text, jsonb, text) from public;
grant execute on function public.submit_brand_discovery(text, jsonb, text) to anon, authenticated;
