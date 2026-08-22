import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Alta y administración de cuentas del equipo.
 *
 * OJO con la seguridad: estas funciones usan la llave de servicio, que se salta
 * las reglas de la base. Y una server function es un endpoint público: cualquiera
 * que conozca la URL puede llamarla. Por eso cada una exige el token de sesión
 * de quien la invoca y verifica CONTRA LA BASE que sea admin. Sin eso,
 * "crear usuario" sería una puerta abierta para dar de alta cuentas.
 */

/** Verifica el token del navegador y devuelve el perfil si es admin. */
async function exigirAdmin(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("Tu sesión no es válida. Vuelve a entrar.");

  const { data: perfil } = await supabaseAdmin
    .from("perfiles")
    .select("id, rol, activo")
    .eq("id", data.user.id)
    .single();

  if (!perfil || !perfil.activo || perfil.rol !== "admin") {
    throw new Error("Solo un administrador puede administrar usuarios.");
  }

  return perfil as { id: string; rol: string; activo: boolean };
}

/** Contraseña temporal legible pero no adivinable. */
function generarPassword(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

const ROLES = ["admin", "editor", "lector"] as const;

const crearSchema = z.object({
  accessToken: z.string().min(1),
  email: z.string().email(),
  nombre: z.string().optional(),
  rol: z.enum(ROLES),
});

export const crearUsuario = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => crearSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirAdmin(data.accessToken);

    const email = data.email.trim().toLowerCase();
    const password = generarPassword();

    const { data: creado, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: data.nombre ?? "" },
    });

    if (error || !creado.user) {
      throw new Error(
        error?.message?.includes("already")
          ? "Ya existe una cuenta con ese correo."
          : (error?.message ?? "No se pudo crear la cuenta."),
      );
    }

    const { error: perfilError } = await supabaseAdmin.from("perfiles").insert({
      id: creado.user.id,
      email,
      nombre: data.nombre?.trim() || email.split("@")[0],
      rol: data.rol,
    });

    if (perfilError) {
      // Si el perfil falla, la cuenta de acceso quedaría huérfana: se limpia.
      await supabaseAdmin.auth.admin.deleteUser(creado.user.id);
      throw new Error(perfilError.message);
    }

    // La contraseña se devuelve UNA vez, para que el admin la comparta.
    return { email, password };
  });

const actualizarSchema = z.object({
  accessToken: z.string().min(1),
  id: z.string().uuid(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  nombre: z.string().optional(),
});

export const actualizarUsuario = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => actualizarSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = await exigirAdmin(data.accessToken);

    // Nadie se quita a sí mismo el rol o el acceso: así no queda la
    // plataforma sin ningún administrador por un clic distraído.
    if (admin.id === data.id && (data.rol !== undefined || data.activo === false)) {
      throw new Error("No puedes cambiar tu propio rol ni desactivarte.");
    }

    const cambios: Record<string, unknown> = {};
    if (data.rol !== undefined) cambios["rol"] = data.rol;
    if (data.activo !== undefined) cambios["activo"] = data.activo;
    if (data.nombre !== undefined) cambios["nombre"] = data.nombre.trim();

    if (Object.keys(cambios).length === 0) return { success: true };

    const { error } = await supabaseAdmin.from("perfiles").update(cambios).eq("id", data.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });

const passwordSchema = z.object({
  accessToken: z.string().min(1),
  id: z.string().uuid(),
});

/** Genera una contraseña nueva cuando alguien pierde la suya. */
export const reiniciarPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data }) => {
    await exigirAdmin(data.accessToken);

    const password = generarPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);

    return { password };
  });

export const eliminarUsuario = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data }) => {
    const admin = await exigirAdmin(data.accessToken);
    if (admin.id === data.id) throw new Error("No puedes eliminar tu propia cuenta.");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });
