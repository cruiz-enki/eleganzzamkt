import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { createDriveFolder, findOrCreateFolder, uploadBase64ToDrive } from "@/lib/api/google-drive";
import { requiereEditor } from "@/lib/api/auth-middleware";

/**
 * Subida de archivos de una publicación a Google Drive.
 *
 * Va en el servidor porque necesita las credenciales de Drive; el resto del
 * CRUD de publicaciones vive en el navegador (publicaciones.ts) para que
 * aplique la sesión del usuario.
 *
 * Si la publicación habla de un mueble, el archivo se guarda dentro de la
 * carpeta de ESE mueble, en una subcarpeta "Publicaciones". La subcarpeta no
 * es un capricho: `listDriveImages` (el botón "sincronizar con Drive") lee los
 * archivos que cuelgan directamente de la carpeta del producto, así que dejar
 * ahí las artes de redes las metería a la galería de fotos del mueble.
 */

const CARPETA_PUBLICACIONES = "Publicaciones";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1),
  muebleId: z.string().nullable().optional(),
});

async function carpetaDestino(muebleId?: string | null): Promise<string | null> {
  if (!muebleId) return findOrCreateFolder(CARPETA_PUBLICACIONES);

  const { data: mueble } = await supabase
    .from("muebles")
    .select("nombre, detalles")
    .eq("id", muebleId)
    .single();

  let carpetaMueble = (mueble?.detalles as { google_drive_folder_id?: string } | null)
    ?.google_drive_folder_id;

  // Si el mueble todavía no tiene carpeta, se la creamos ahora.
  if (!carpetaMueble && mueble?.nombre) {
    const nueva = await createDriveFolder(mueble.nombre);
    if (nueva) {
      carpetaMueble = nueva;
      await supabase
        .from("muebles")
        .update({
          detalles: {
            ...((mueble.detalles as Record<string, unknown>) ?? {}),
            google_drive_folder_id: nueva,
          },
        })
        .eq("id", muebleId);
    }
  }

  if (!carpetaMueble) return findOrCreateFolder(CARPETA_PUBLICACIONES);

  return findOrCreateFolder(CARPETA_PUBLICACIONES, carpetaMueble);
}

export const uploadPublicacionArchivo = createServerFn({ method: "POST" })
  .middleware([requiereEditor])
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const folderId = await carpetaDestino(data.muebleId ?? null);

    if (!folderId) {
      throw new Error(
        "No se pudo preparar la carpeta de Publicaciones en Google Drive. Revisa la conexión con Drive.",
      );
    }

    const subido = await uploadBase64ToDrive({
      fileName: data.fileName,
      mimeType: data.mimeType,
      base64: data.base64,
      folderId,
    });

    return {
      id: subido.id,
      url: subido.url,
      nombre: data.fileName,
      mimeType: data.mimeType,
    };
  });
