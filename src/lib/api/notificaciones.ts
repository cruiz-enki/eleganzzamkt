import { supabase } from "@/lib/supabase-client";

/**
 * Notificaciones dentro de la app. Cada quien ve solo las suyas: eso lo
 * garantiza RLS, no este archivo.
 */

export type TipoNotificacion = "decision_cliente" | "marca_catalogo" | "falla_tecnica" | "proceso";

export type Notificacion = {
  id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string | null;
  seccion: string | null;
  referencia_id: string | null;
  leida_at: string | null;
  created_at: string;
};

export async function getNotificaciones(limite = 30) {
  const { data, error } = await supabase
    .from("notificaciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limite);

  if (error) throw new Error(error.message);
  return (data ?? []) as Notificacion[];
}

export async function marcarLeida(id: string) {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function marcarTodasLeidas() {
  const { error } = await supabase
    .from("notificaciones")
    .update({ leida_at: new Date().toISOString() })
    .is("leida_at", null);

  if (error) throw new Error(error.message);
}

/**
 * Crea un aviso para todo el equipo desde la app (procesos y fallas técnicas).
 * Los eventos del portal del cliente se disparan en la base, porque ahí no hay
 * sesión de nadie del equipo.
 */
export async function notificarAlEquipo(input: {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje?: string;
  seccion?: string;
  referenciaId?: string;
}) {
  const { error } = await supabase.rpc("crear_notificacion", {
    p_tipo: input.tipo,
    p_titulo: input.titulo,
    p_mensaje: input.mensaje ?? null,
    p_seccion: input.seccion ?? null,
    p_referencia_id: input.referenciaId ?? null,
  });

  // Un aviso que falla no debe tumbar la operación que lo generó.
  if (error) console.error("No se pudo crear la notificación:", error.message);
}
