import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requiereAdmin } from "@/lib/api/auth-middleware";

/**
 * Alta y administración de cuentas del equipo.
 *
 * El candado lo pone `requiereAdmin`: verifica el token de sesión de quien
 * llama y exige rol admin. Sin eso, "crear usuario" sería una puerta abierta,
 * porque una server function es un endpoint público que además corre con la
 * llave de servicio.
 */

/** Contraseña temporal legible pero no adivinable. */
function generarPassword(): string {
  const alfabeto = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join("");
}

const ROLES = ["admin", "editor", "lector"] as const;

const crearSchema = z.object({
  email: z.string().email(),
  nombre: z.string().optional(),
  rol: z.enum(ROLES),
});

export const crearUsuario = createServerFn({ method: "POST" })
  .middleware([requiereAdmin])
  .inputValidator((data: unknown) => crearSchema.parse(data))
  .handler(async ({ data }) => {
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
  id: z.string().uuid(),
  rol: z.enum(ROLES).optional(),
  activo: z.boolean().optional(),
  nombre: z.string().optional(),
});

export const actualizarUsuario = createServerFn({ method: "POST" })
  .middleware([requiereAdmin])
  .inputValidator((data: unknown) => actualizarSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = context.perfil;

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
  id: z.string().uuid(),
});

/** Genera una contraseña nueva cuando alguien pierde la suya. */
export const reiniciarPassword = createServerFn({ method: "POST" })
  .middleware([requiereAdmin])
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data }) => {
    const password = generarPassword();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, { password });
    if (error) throw new Error(error.message);

    return { password };
  });

export const eliminarUsuario = createServerFn({ method: "POST" })
  .middleware([requiereAdmin])
  .inputValidator((data: unknown) => passwordSchema.parse(data))
  .handler(async ({ data, context }) => {
    const admin = context.perfil;
    if (admin.id === data.id) throw new Error("No puedes eliminar tu propia cuenta.");

    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);

    return { success: true };
  });
