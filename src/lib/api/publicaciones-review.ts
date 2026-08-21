import { supabase } from "@/lib/supabase-client";
import type { PublicacionArchivo, PublicacionEstado } from "@/lib/api/publicaciones";

/**
 * Portal público de aprobación de publicaciones (por token).
 *
 * Igual que el portal del catálogo: el visitante entra sin cuenta y solo puede
 * tocar dos RPCs `security definer`. Las tablas no están expuestas al rol anon.
 */

export type PublicacionReviewComentario = {
  id: string;
  autor: string | null;
  mensaje: string | null;
  tipo: string;
  createdAt: string;
};

export type PublicacionReview = {
  id: string;
  titulo: string;
  copy: string | null;
  canal: string | null;
  fechaProgramada: string | null;
  archivos: PublicacionArchivo[];
  estado: PublicacionEstado;
  aprobadaPor: string | null;
  aprobadaAt: string | null;
  comentarios: PublicacionReviewComentario[];
};

export type PublicacionesReviewLink = {
  title: string;
  clientName: string | null;
  introMessage: string | null;
  expiresAt: string | null;
};

export type Decision = "aprobada" | "cambios_solicitados" | "rechazada";

type ReviewRpcResponse =
  | { success: true; link: PublicacionesReviewLink; publicaciones: PublicacionReview[] }
  | { success: false; errorCode: string; message: string };

export async function getPublicacionesReview(token: string) {
  const { data, error } = await supabase.rpc("get_publicaciones_review", { p_token: token });

  if (error) throw new Error(error.message);

  const result = data as ReviewRpcResponse;
  if (!result.success) throw new Error(result.message);

  return { link: result.link, publicaciones: result.publicaciones };
}

export async function setPublicacionDecision(input: {
  token: string;
  publicacionId: string;
  decision: Decision;
  comentario?: string;
  reviewerName?: string;
}) {
  const { data, error } = await supabase.rpc("set_publicacion_decision", {
    p_token: input.token,
    p_publicacion_id: input.publicacionId,
    p_decision: input.decision,
    p_comentario: input.comentario ?? null,
    p_reviewer_name: input.reviewerName ?? null,
  });

  if (error) throw new Error(error.message);

  const result = data as { success: boolean; message?: string; estado?: PublicacionEstado };
  if (!result.success) throw new Error(result.message ?? "No se pudo guardar la decisión.");

  return result;
}
