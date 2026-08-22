import { createMiddleware } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";

/**
 * Candado para las server functions.
 *
 * El problema que resuelve: una server function es un endpoint público —
 * cualquiera que conozca la URL puede llamarla— y además corre con la llave de
 * servicio, que se salta las reglas de la base. Sin este candado, cerrar la
 * base con RLS no sirve de nada: quedaba una puerta de servicio abierta.
 *
 * Cómo funciona: la mitad `client` toma el token de la sesión del navegador y
 * lo manda; la mitad `server` lo verifica contra Supabase y lee el perfil para
 * exigir el rol mínimo. Así no hay que cambiar la firma de cada función ni
 * tocar quien las llama.
 *
 * Las funciones que sirven al portal público (revisión por token) NO llevan
 * candado a propósito: ahí no hay sesión, y la autorización la hace el token
 * del enlace dentro de las RPC.
 */

type Nivel = "ver" | "editar" | "admin";

const ROLES_POR_NIVEL: Record<Nivel, string[]> = {
  ver: ["admin", "editor", "lector"],
  editar: ["admin", "editor"],
  admin: ["admin"],
};

const MENSAJE: Record<Nivel, string> = {
  ver: "Necesitas iniciar sesión.",
  editar: "Tu rol no permite hacer cambios.",
  admin: "Solo un administrador puede hacer esto.",
};

function crearCandado(nivel: Nivel) {
  return createMiddleware({ type: "function" })
    .client(async ({ next }) => {
      const { data } = await supabase.auth.getSession();
      return next({ sendContext: { accessToken: data.session?.access_token ?? null } });
    })
    .server(async ({ next, context }) => {
      const accessToken = (context as { accessToken?: string | null }).accessToken ?? null;
      if (!accessToken) throw new Error("Necesitas iniciar sesión.");

      // Import dinámico: así el cliente de servicio no acaba en el bundle del
      // navegador solo por importar este archivo.
      const { supabaseAdmin } = await import("@/lib/supabase-admin");

      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (error || !data.user) throw new Error("Tu sesión expiró. Vuelve a entrar.");

      const { data: perfil } = await supabaseAdmin
        .from("perfiles")
        .select("id, email, rol, activo")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!perfil || !perfil.activo) throw new Error("Tu cuenta no tiene acceso.");
      if (!ROLES_POR_NIVEL[nivel].includes(perfil.rol as string)) throw new Error(MENSAJE[nivel]);

      return next({ context: { perfil } });
    });
}

/** Cualquier persona del equipo con sesión activa (incluye lector). */
export const requiereSesion = crearCandado("ver");

/** Admin o editor: todo lo que modifica datos. */
export const requiereEditor = crearCandado("editar");

/** Solo administradores: borrar y administrar. */
export const requiereAdmin = crearCandado("admin");
