import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";

/**
 * Cliente de Supabase para uso EXCLUSIVO EN EL SERVIDOR (server functions).
 *
 * Por qué existe: las server functions corren sin la sesión del usuario, así que
 * con la llave pública actúan como `anon`. Eso obligaba a dejar las tablas del
 * catálogo abiertas a `anon` — es decir, a cualquiera que tomara la llave del
 * navegador. Con la llave de servicio el servidor tiene sus propios permisos y
 * las tablas pueden quedar cerradas al público.
 *
 * La variable NO lleva prefijo VITE_ a propósito: así Vite nunca la mete en el
 * bundle del navegador. Nunca importes este archivo desde un componente.
 *
 * Si aún no está configurada la llave de servicio, cae al cliente público para
 * no romper nada mientras se termina de migrar.
 */
const supabaseUrl =
  import.meta.env["VITE_SUPABASE_URL"] || "https://eqshiiiekxbpsdilckuv.supabase.co";
const serviceRoleKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!serviceRoleKey && typeof window === "undefined") {
  console.warn(
    "[supabase-admin] Falta SUPABASE_SERVICE_ROLE_KEY: las server functions seguirán usando la llave pública.",
  );
}

export const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : supabase;
