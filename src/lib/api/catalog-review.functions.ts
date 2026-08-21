/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { createDriveFolder, uploadBase64ToDrive } from "@/lib/api/google-drive";

// FASE 5 — Subida de fotografías reales desde el portal por token.
// Server function: corre en el servidor con credenciales de Google Drive
// (nunca en el browser). Valida el token vía RPC security definer antes de
// subir, y registra el asset con register_catalog_review_asset (token-scoped).

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB por archivo

const schema = z.object({
  token: z.string().min(1),
  muebleId: z.string().uuid(),
  reviewerName: z.string().optional().nullable(),
  files: z
    .array(
      z.object({
        fileName: z.string().min(1),
        mimeType: z.string().min(1),
        base64: z.string().min(1),
      }),
    )
    .min(1)
    .max(10),
});

export const uploadCatalogReviewPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    // Validación de MIME y tamaño (server-side, no confiar en el frontend).
    for (const f of data.files) {
      if (!ALLOWED_MIME.has(f.mimeType)) {
        throw new Error("Formato no permitido. Usa JPG, PNG o WEBP.");
      }
      const bytes = Math.floor(f.base64.length * 0.75);
      if (bytes > MAX_BYTES) {
        throw new Error("Cada imagen debe pesar menos de 10 MB.");
      }
    }

    // 1) Validar token + scope y obtener el producto (incluye carpeta de Drive).
    const { data: rpc, error } = await supabase.rpc("get_catalog_review_product", {
      p_token: data.token,
      p_mueble_id: data.muebleId,
    });
    if (error) throw new Error(error.message);
    const res = rpc as any;
    if (!res?.success) throw new Error(res?.message || "Este enlace no es válido para subir fotos.");

    const product = res.product;
    let folderId: string | null = product?.detalles?.google_drive_folder_id ?? null;
    if (!folderId) folderId = await createDriveFolder(product?.nombre || "Producto Eleganzza");

    let uploaded = 0;
    for (let i = 0; i < data.files.length; i++) {
      const f = data.files[i]!;
      const up = await uploadBase64ToDrive({
        fileName: f.fileName,
        mimeType: f.mimeType,
        base64: f.base64,
        folderId,
      });
      const { data: reg, error: regErr } = await supabase.rpc("register_catalog_review_asset", {
        p_token: data.token,
        p_mueble_id: data.muebleId,
        p_url: up.url,
        p_drive_file_id: up.id,
        p_nombre_archivo: f.fileName,
        p_reviewer_name: data.reviewerName ?? null,
      });
      if (regErr) throw new Error(regErr.message);
      const regRes = reg as any;
      if (!regRes?.success) throw new Error(regRes?.message || "No fue posible registrar la foto.");
      uploaded += 1;
    }

    return { success: true, count: uploaded };
  });
