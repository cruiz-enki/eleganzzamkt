/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

// FASE 2 — capa de datos (admin) para mueble_assets.
// El portal público NO usa esto; usa las RPCs security definer (catalog-review.ts).

export type MuebleAsset = {
  id: string;
  mueble_id: string;
  tipo: string;
  url: string | null;
  drive_file_id: string | null;
  nombre_archivo: string | null;
  origen: string | null;
  descripcion: string | null;
  es_principal: boolean;
  estado_revision: "pendiente" | "aprobada" | "rechazada" | "cambios_solicitados";
  aprobada_por: string | null;
  aprobada_at: string | null;
  notas: string | null;
  metadata: any;
  ai_validation_status: string | null;
  ai_validation_score: number | null;
  ai_validation_notes: string | null;
  created_at: string;
  updated_at: string;
};

const MISSING_TABLE = /relation .*mueble_assets.* does not exist/i;

function tolerateMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "PGRST205" || (error.message ? MISSING_TABLE.test(error.message) : false);
}

export const getMuebleAssets = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ muebleId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: rows, error } = await supabase
      .from("mueble_assets")
      .select("*")
      .eq("mueble_id", data.muebleId)
      .order("es_principal", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (tolerateMissingTable(error)) return [] as MuebleAsset[];
      throw new Error(error.message);
    }
    return (rows ?? []) as MuebleAsset[];
  });

const assetSchema = z.object({
  id: z.string().optional(),
  mueble_id: z.string(),
  tipo: z
    .enum(["catalogo", "original", "foto_real", "editada", "ia", "ecommerce", "campana", "otro"])
    .default("otro"),
  url: z.string().optional().nullable(),
  drive_file_id: z.string().optional().nullable(),
  nombre_archivo: z.string().optional().nullable(),
  origen: z.string().optional().nullable(),
  descripcion: z.string().optional().nullable(),
  es_principal: z.boolean().optional(),
  metadata: z.any().optional(),
});

export const upsertMuebleAsset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => assetSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...rest } = data;
    if (id) {
      const { data: row, error } = await supabase
        .from("mueble_assets")
        .update(rest)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return row as MuebleAsset;
    }
    const { data: row, error } = await supabase
      .from("mueble_assets")
      .insert(rest)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as MuebleAsset;
  });

export const setAssetReviewDecision = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        decision: z.enum(["aprobada", "rechazada", "cambios_solicitados", "pendiente"]),
        aprobadaPor: z.string().optional().nullable(),
        notas: z.string().optional().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {
      estado_revision: data.decision,
      notas: data.notas ?? null,
    };
    if (data.decision === "aprobada") {
      patch["aprobada_por"] = data.aprobadaPor ?? null;
      patch["aprobada_at"] = new Date().toISOString();
    }
    const { error } = await supabase.from("mueble_assets").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const deleteMuebleAsset = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("mueble_assets").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { success: true };
  });
