/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabase-client";

// Capa de datos de TRAZABILIDAD (admin). Cliente-side: usa la sesión de Auth
// del usuario (rol authenticated), por eso puede leer/escribir tablas con RLS
// admin-only (mueble_assets, review_comments, campana_*). NO usar createServerFn
// aquí: en el servidor el cliente actúa como anon y RLS lo bloquearía.

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

export type ReviewComment = {
  id: string;
  mueble_id: string | null;
  asset_id: string | null;
  autor: string | null;
  mensaje: string;
  tipo: string;
  created_at: string;
};

export type CatalogTraceabilityStats = {
  total: number;
  verificado: number;
  por_verificar: number;
  incompleto: number;
  rechazado: number;
  conFotosReales: number;
  sinFotosReales: number;
  assetsPendientes: number;
  cambiosSolicitados: number;
};

const REAL_TYPES = new Set(["foto_real", "original"]);
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/;

function imgRef(img: any): { url: string | null; drive: string | null } | null {
  if (!img || typeof img !== "object") return null;
  const url = typeof img.url === "string" ? img.url : null;
  const id = typeof img.id === "string" && DRIVE_ID.test(img.id) ? img.id : null;
  if (!url && !id) return null;
  return { url, drive: id };
}

export async function getMuebleAssets(muebleId: string) {
  const { data, error } = await supabase
    .from("mueble_assets")
    .select("*")
    .eq("mueble_id", muebleId)
    .order("es_principal", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as MuebleAsset[];
}

export async function setAssetReviewDecision(input: {
  id: string;
  decision: "aprobada" | "rechazada" | "cambios_solicitados" | "pendiente";
  aprobadaPor?: string | null;
  notas?: string | null;
}) {
  const patch: Record<string, unknown> = { estado_revision: input.decision };
  if (input.notas != null) patch["notas"] = input.notas;
  if (input.decision === "aprobada") {
    patch["aprobada_por"] = input.aprobadaPor ?? null;
    patch["aprobada_at"] = new Date().toISOString();
  }
  const { error } = await supabase.from("mueble_assets").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  return { success: true };
}

export async function deleteMuebleAsset(id: string) {
  const { error } = await supabase.from("mueble_assets").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Backfill: crea assets (tipo "catalogo", estado "pendiente") a partir de las
 * imágenes existentes en galeria/fotos, SOLO para muebles que aún no tienen
 * ningún asset. Idempotente y no destructivo.
 */
export async function backfillMuebleAssets() {
  const [{ data: muebles, error: e1 }, { data: existing, error: e2 }] = await Promise.all([
    supabase.from("muebles").select("id, galeria, fotos"),
    supabase.from("mueble_assets").select("mueble_id"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const withAssets = new Set((existing ?? []).map((r: any) => r.mueble_id));
  const rows: Array<Record<string, unknown>> = [];

  for (const m of muebles ?? []) {
    if (withAssets.has((m as any).id)) continue;
    const imgs = [...(((m as any).galeria as any[]) ?? []), ...(((m as any).fotos as any[]) ?? [])];
    let idx = 0;
    for (const img of imgs) {
      const ref = imgRef(img);
      if (!ref) continue;
      rows.push({
        mueble_id: (m as any).id,
        tipo: "catalogo",
        url: ref.url,
        drive_file_id: ref.drive,
        origen: "backfill",
        estado_revision: "pendiente",
        es_principal: idx === 0,
      });
      idx += 1;
    }
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const { error } = await supabase.from("mueble_assets").insert(chunk);
    if (error) throw new Error(error.message);
    inserted += chunk.length;
  }
  return { success: true, inserted, productos: new Set(rows.map((r) => r["mueble_id"])).size };
}

export async function getCatalogTraceabilityStats(): Promise<CatalogTraceabilityStats> {
  const [{ data: muebles, error: e1 }, { data: assets, error: e2 }] = await Promise.all([
    supabase.from("muebles").select("id, estado_verificacion"),
    supabase.from("mueble_assets").select("mueble_id, tipo, estado_revision"),
  ]);
  if (e1) throw new Error(e1.message);
  if (e2) throw new Error(e2.message);

  const realByMueble = new Set<string>();
  let assetsPendientes = 0;
  let cambiosSolicitados = 0;
  for (const a of assets ?? []) {
    if (REAL_TYPES.has((a as any).tipo)) realByMueble.add((a as any).mueble_id);
    if ((a as any).estado_revision === "pendiente") assetsPendientes += 1;
    if ((a as any).estado_revision === "cambios_solicitados") cambiosSolicitados += 1;
  }

  const stats: CatalogTraceabilityStats = {
    total: muebles?.length ?? 0,
    verificado: 0,
    por_verificar: 0,
    incompleto: 0,
    rechazado: 0,
    conFotosReales: 0,
    sinFotosReales: 0,
    assetsPendientes,
    cambiosSolicitados,
  };

  for (const m of muebles ?? []) {
    const estado = (m as any).estado_verificacion ?? "por_verificar";
    if (estado === "verificado") stats.verificado += 1;
    else if (estado === "rechazado") stats.rechazado += 1;
    else if (estado === "incompleto") stats.incompleto += 1;
    else stats.por_verificar += 1;

    if (realByMueble.has((m as any).id)) stats.conFotosReales += 1;
    else stats.sinFotosReales += 1;
  }

  return stats;
}

export type MuebleTraceability = {
  mueble: any;
  assets: MuebleAsset[];
  comments: ReviewComment[];
  campanas: Array<{ id: string; nombre: string }>;
};

export async function getMuebleTraceability(muebleId: string): Promise<MuebleTraceability> {
  const [mueble, assets, comments, links] = await Promise.all([
    supabase.from("muebles").select("*").eq("id", muebleId).single(),
    supabase
      .from("mueble_assets")
      .select("*")
      .eq("mueble_id", muebleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("review_comments")
      .select("*")
      .eq("mueble_id", muebleId)
      .order("created_at", { ascending: false }),
    supabase
      .from("campana_muebles")
      .select("campana_id, campanas:campana_id(id, nombre)")
      .eq("mueble_id", muebleId),
  ]);

  if (mueble.error) throw new Error(mueble.error.message);

  const campanas = (links.data ?? [])
    .map((r: any) => r.campanas)
    .filter(Boolean)
    .map((c: any) => ({ id: c.id, nombre: c.nombre }));

  return {
    mueble: mueble.data,
    assets: (assets.data ?? []) as MuebleAsset[],
    comments: (comments.data ?? []) as ReviewComment[],
    campanas,
  };
}
