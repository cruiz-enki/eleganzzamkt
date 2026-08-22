import { supabase } from "@/lib/supabase-client";

/**
 * Lectura de perfiles y del rol propio, desde el navegador (con la sesión).
 * Las altas y cambios pasan por usuarios.functions.ts, que valida que quien
 * llama sea admin.
 */

export type Rol = "admin" | "editor" | "lector";

export type Perfil = {
  id: string;
  email: string;
  nombre: string | null;
  rol: Rol;
  activo: boolean;
  created_at: string;
};

export const ROL_LABEL: Record<Rol, string> = {
  admin: "Administrador",
  editor: "Editor",
  lector: "Lector",
};

export const ROL_DESCRIPCION: Record<Rol, string> = {
  admin: "Todo, incluye usuarios, configuración y borrar",
  editor: "Ve y edita productos, publicaciones y campañas. No borra",
  lector: "Solo puede ver",
};

/** El perfil de quien está usando la app. null = no tiene acceso. */
export async function getMiPerfil(): Promise<Perfil | null> {
  const { data: sesion } = await supabase.auth.getUser();
  if (!sesion.user) return null;

  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .eq("id", sesion.user.id)
    .maybeSingle();

  if (error) return null;
  return (data as Perfil) ?? null;
}

export async function getPerfiles() {
  const { data, error } = await supabase
    .from("perfiles")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as Perfil[];
}

/** El token de la sesión, que las funciones de administración exigen. */
export async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("No hay sesión activa.");
  return token;
}

/** Permisos que la interfaz usa para esconder lo que no aplica. */
export function permisos(rol: Rol | null | undefined) {
  return {
    puedeVer: rol === "admin" || rol === "editor" || rol === "lector",
    puedeEditar: rol === "admin" || rol === "editor",
    puedeBorrar: rol === "admin",
    esAdmin: rol === "admin",
  };
}
