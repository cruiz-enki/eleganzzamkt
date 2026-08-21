import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { findOrCreateFolder, uploadBase64ToDrive } from "@/lib/api/google-drive";

/**
 * Subida de archivos de una publicación a Google Drive.
 *
 * Va en el servidor porque necesita las credenciales de Drive; el resto del
 * CRUD de publicaciones vive en el navegador (publicaciones.ts) para que
 * aplique la sesión del usuario.
 */

const CARPETA_PUBLICACIONES = "Publicaciones";

const uploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  base64: z.string().min(1),
});

export const uploadPublicacionArchivo = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    const folderId = await findOrCreateFolder(CARPETA_PUBLICACIONES);

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
