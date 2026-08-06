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
