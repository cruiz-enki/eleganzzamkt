import { supabase } from "@/lib/supabase-client";

/**
 * Capa de datos de PUBLICACIONES.
 *
 * Cliente-side a propósito: `publicaciones` y `publicacion_comentarios` tienen
 * RLS admin-only, así que necesitan la sesión de Auth del usuario. En el
 * servidor el cliente público actúa como anon y RLS lo bloquearía.
 * (Las RPCs del portal por token viven en publicaciones-review.ts.)
 */

export type PublicacionEstado =
  "borrador" | "en_revision" | "aprobada" | "cambios_solicitados" | "rechazada" | "publicada";

export type PublicacionArchivo = {
  id: string;
  url: string;
  nombre?: string;
  mimeType?: string;
};

export type PublicacionComentario = {
  id: string;
  publicacion_id: string;
  autor: string | null;
  mensaje: string | null;
  tipo: string;
  created_at: string;
};

export type Publicacion = {
  id: string;
  titulo: string;
  copy: string | null;
  canal: string | null;
  fecha_programada: string | null;
  campana_id: string | null;
  mueble_id: string | null;
  archivos: PublicacionArchivo[];
  estado: PublicacionEstado;
  aprobada_por: string | null;
  aprobada_at: string | null;
  notas: string | null;
  detalles: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export const ESTADO_LABEL: Record<PublicacionEstado, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  aprobada: "Aprobada",
  cambios_solicitados: "Cambios solicitados",
  rechazada: "Rechazada",
  publicada: "Publicada",
};

export const CANALES = ["Instagram", "Facebook", "TikTok", "WhatsApp", "Otro"] as const;

export async function getPublicaciones() {
  const { data, error } = await supabase
    .from("publicaciones")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Publicacion[];
}

export async function getPublicacionComentarios(publicacionId: string) {
  const { data, error } = await supabase
    .from("publicacion_comentarios")
    .select("*")
    .eq("publicacion_id", publicacionId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as PublicacionComentario[];
}

export type UpsertPublicacionInput = {
  id?: string;
  titulo: string;
  copy?: string | null;
  canal?: string | null;
  fechaProgramada?: string | null;
  campanaId?: string | null;
  muebleId?: string | null;
  archivos?: PublicacionArchivo[];
  notas?: string | null;
};

export async function upsertPublicacion(input: UpsertPublicacionInput) {
  const payload = {
    titulo: input.titulo,
    copy: input.copy ?? null,
    canal: input.canal ?? null,
    fecha_programada: input.fechaProgramada || null,
    campana_id: input.campanaId || null,
    mueble_id: input.muebleId || null,
    archivos: input.archivos ?? [],
    notas: input.notas ?? null,
  };

  const query = input.id
    ? supabase.from("publicaciones").update(payload).eq("id", input.id)
    : supabase.from("publicaciones").insert(payload);

  const { data, error } = await query.select("*").single();
  if (error) throw new Error(error.message);
  return data as Publicacion;
}

export async function deletePublicacion(id: string) {
  const { error } = await supabase.from("publicaciones").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Cambia el estado desde el panel (enviar a revisión, marcar publicada,
 * regresar a borrador). Las decisiones del cliente NO pasan por aquí: esas
 * entran por la RPC del portal.
 */
export async function setPublicacionEstado(id: string, estado: PublicacionEstado) {
  const { error } = await supabase.from("publicaciones").update({ estado }).eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/** Publicaciones ligadas a un mueble, para la pestaña de su ficha. */
export async function getPublicacionesDeMueble(muebleId: string) {
  const { data, error } = await supabase
    .from("publicaciones")
    .select("*")
    .eq("mueble_id", muebleId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as Publicacion[];
}

/** Lista ligera de muebles para el selector del editor de publicaciones. */
export async function getMueblesParaSelector() {
  const { data, error } = await supabase
    .from("muebles")
    .select("id, nombre, categoria")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ id: string; nombre: string; categoria: string | null }>;
}
