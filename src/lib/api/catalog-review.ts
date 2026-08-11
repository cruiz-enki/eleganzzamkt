import { supabase } from "@/lib/supabase-client";
import type { Mueble } from "@/lib/api/inventory.functions";

export type ReviewAction = "delete" | "change_photo" | "change_price" | "note" | "other";

export type CatalogReviewMark = {
  id: string;
  requested_action: ReviewAction;
  note: string | null;
  suggested_price: number | null;
  reviewer_name: string | null;
  status: "open" | "reviewed" | "resolved" | "dismissed";
  created_at: string;
};

export type CatalogReviewProduct = Mueble & {
  marks: CatalogReviewMark[];
};

export type CatalogReviewLink = {
  id: string;
  token: string;
  title: string;
  client_name: string | null;
  intro_message: string | null;
  filters: CatalogReviewFilters;
  is_active: boolean;
  expires_at: string | null;
  last_viewed_at: string | null;
  created_at: string;
};

export type PublicCatalogReview = {
  link: Omit<CatalogReviewLink, "token" | "is_active" | "last_viewed_at">;
  products: CatalogReviewProduct[];
};

export type CatalogReviewFilters = {
  categories?: string[];
  statuses?: string[];
  productIds?: string[];
};

type CatalogReviewRpcResponse =
  | {
      success: true;
      link: PublicCatalogReview["link"];
      products: CatalogReviewProduct[];
    }
  | {
      success: false;
      errorCode: string;
      message: string;
    };

export type CreateCatalogReviewLinkInput = {
  title: string;
  clientName?: string;
  introMessage?: string;
  filters?: CatalogReviewFilters;
  expiresAt?: string | null;
};

export async function getCatalogReviewLinks() {
  const { data, error } = await supabase
    .from("catalog_review_links")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data as CatalogReviewLink[];
}

export async function createCatalogReviewLink(input: CreateCatalogReviewLinkInput) {
  const { data, error } = await supabase
    .from("catalog_review_links")
    .insert({
      title: input.title,
      client_name: input.clientName || null,
      intro_message: input.introMessage || null,
      filters: input.filters || {},
      expires_at: input.expiresAt || null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as CatalogReviewLink;
}

export async function updateCatalogReviewLinkStatus(id: string, isActive: boolean) {
  const { error } = await supabase
    .from("catalog_review_links")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(error.message);
  return { success: true };
}

export async function getCatalogReviewMarks(linkId?: string) {
  let query = supabase
    .from("catalog_review_marks")
    .select(
      "*, muebles:mueble_id(id,nombre,categoria,precio,galeria,fotos), catalog_review_links:link_id(id,title,client_name)",
    )
    .order("created_at", { ascending: false });

  if (linkId) query = query.eq("link_id", linkId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

export async function getPublicCatalogReview(token: string) {
  const { data, error } = await supabase.rpc("get_catalog_review", { p_token: token });

  if (error) throw new Error(error.message);

  const result = data as CatalogReviewRpcResponse;
  if (!result.success) throw new Error(result.message);

  return {
    link: result.link,
    products: result.products,
  } satisfies PublicCatalogReview;
}

export async function submitCatalogReviewMark(input: {
  token: string;
  productId: string;
  action: ReviewAction;
  note?: string;
  suggestedPrice?: number | null;
  reviewerName?: string;
}) {
  const { data, error } = await supabase.rpc("submit_catalog_review_mark", {
    p_token: input.token,
    p_mueble_id: input.productId,
    p_requested_action: input.action,
    p_note: input.note || null,
    p_suggested_price: input.suggestedPrice ?? null,
    p_reviewer_name: input.reviewerName || null,
  });

  if (error) throw new Error(error.message);
  const result = data as { success: boolean; message?: string };
  if (!result.success) throw new Error(result.message || "No fue posible registrar la solicitud");
  return result;
}

// =====================================================================
// FASE 3/4/5 — Portal de revisión: assets, verificación, comentarios.
// Envuelven las RPCs security definer (ver migración 20260810120400).
// =====================================================================

export type CatalogReviewAsset = {
  id: string;
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
  created_at: string;
};

export type CatalogReviewComment = {
  id: string;
  asset_id: string | null;
  autor: string | null;
  mensaje: string;
  tipo: string;
  created_at: string;
};

export type CatalogReviewProductDetail = {
  id: string;
  nombre: string;
  sku: string | null;
  categoria: string | null;
  descripcion: string | null;
  precio: number | null;
  precio_2: number | null;
  precio_3: number | null;
  marca: string | null;
  materiales: string | null;
  colores: string | null;
  medidas: string | null;
  detalles: unknown;
  fotos: unknown[] | null;
  galeria: unknown[] | null;
  estado_verificacion: "incompleto" | "por_verificar" | "verificado" | "rechazado";
  verificado_por: string | null;
  verificado_at: string | null;
  observaciones: string | null;
  assets: CatalogReviewAsset[];
  comments: CatalogReviewComment[];
};

async function callRpc<T>(fn: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, params);
  if (error) throw new Error(error.message);
  const result = data as { success: boolean; message?: string } & T;
  if (!result.success) throw new Error(result.message || "Operación no permitida");
  return result;
}

export async function getCatalogReviewProduct(token: string, muebleId: string) {
  const result = await callRpc<{ product: CatalogReviewProductDetail }>(
    "get_catalog_review_product",
    { p_token: token, p_mueble_id: muebleId },
  );
  return result.product;
}

export async function setCatalogReviewVerification(input: {
  token: string;
  muebleId: string;
  estado: "verificado" | "rechazado" | "por_verificar";
  reviewerName?: string;
  note?: string;
}) {
  return callRpc("set_catalog_review_verification", {
    p_token: input.token,
    p_mueble_id: input.muebleId,
    p_estado: input.estado,
    p_reviewer_name: input.reviewerName || null,
    p_note: input.note || null,
  });
}

export async function setCatalogAssetDecision(input: {
  token: string;
  assetId: string;
  decision: "aprobada" | "rechazada" | "cambios_solicitados";
  reviewerName?: string;
  note?: string;
}) {
  return callRpc("set_catalog_asset_decision", {
    p_token: input.token,
    p_asset_id: input.assetId,
    p_decision: input.decision,
    p_reviewer_name: input.reviewerName || null,
    p_note: input.note || null,
  });
}

export async function addCatalogReviewComment(input: {
  token: string;
  muebleId: string;
  assetId?: string | null;
  autor?: string;
  mensaje: string;
}) {
  return callRpc("add_catalog_review_comment", {
    p_token: input.token,
    p_mueble_id: input.muebleId,
    p_asset_id: input.assetId ?? null,
    p_autor: input.autor || null,
    p_mensaje: input.mensaje,
  });
}
