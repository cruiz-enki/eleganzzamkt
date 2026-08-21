-- Corrige get_publicaciones_review.
--
-- La version anterior hacia `jsonb_agg(p order by p.orden, ...)`, donde `p` es
-- el objeto jsonb construido y `orden` una columna hermana de la subconsulta.
-- Postgres respondia: missing FROM-clause entry for table "p", asi que el
-- portal no abria. Ahora las columnas de orden se referencian por el alias de
-- la subconsulta.

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

  select coalesce(
           jsonb_agg(
             ordenadas.dato
             order by ordenadas.orden, ordenadas.fecha_programada nulls last, ordenadas.creada_en
           ),
           '[]'::jsonb
         )
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
      ) as dato,
      case pub.estado when 'en_revision' then 0 else 1 end as orden,
      pub.fecha_programada as fecha_programada,
      pub.created_at as creada_en
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

revoke all on function public.get_publicaciones_review(text) from public;
grant execute on function public.get_publicaciones_review(text) to anon, authenticated;
