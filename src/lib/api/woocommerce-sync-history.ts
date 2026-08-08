import { supabase } from "@/lib/supabase-client";

export type WooSyncHistoryStatus = "success" | "failed" | "pending" | "skipped";
export type WooSyncHistoryEventType = "product_sync" | "image_sync";

export type WooSyncHistoryImage = {
  src?: string | null;
  sourceId?: string | null;
  originalUrl?: string | null;
  name?: string | null;
};

export type WooSyncHistoryImageSummary = {
  status?: string;
  message?: string;
  total?: number;
  sent?: number;
  failed?: number;
  failedImages?: WooSyncHistoryImage[];
  images?: WooSyncHistoryImage[];
};

export type WooSyncHistoryPayloadSummary = {
  name?: string;
  status?: string;
  regularPrice?: string | null;
  categoryName?: string | null;
  categoryId?: number | null;
  price2?: string | number | null;
  price3?: string | number | null;
  descriptionSent?: boolean;
  imageCount?: number;
};

export type WooSyncHistoryEntry = {
  id: string;
  product_id: string;
  job_id: string | null;
  event_type: WooSyncHistoryEventType;
  status: WooSyncHistoryStatus;
  action: "created" | "updated" | null;
  changed_by: string | null;
  changed_by_email: string | null;
  woo_product_id: number | null;
  woo_permalink: string | null;
  category_name: string | null;
  category_id: number | null;
  regular_price: string | null;
  price_2: string | null;
  price_3: string | null;
  changed_fields: string[];
  payload_summary: WooSyncHistoryPayloadSummary;
  image_summary: WooSyncHistoryImageSummary;
  error_code: string | null;
  error_message: string | null;
  message: string;
  synced_at: string;
  created_at: string;
};

const HISTORY_SELECT = `
  id,
  product_id,
  job_id,
  event_type,
  status,
  action,
  changed_by,
  changed_by_email,
  woo_product_id,
  woo_permalink,
  category_name,
  category_id,
  regular_price,
  price_2,
  price_3,
  changed_fields,
  payload_summary,
  image_summary,
  error_code,
  error_message,
  message,
  synced_at,
  created_at
`;

function asHistoryEntry(row: unknown): WooSyncHistoryEntry {
  const entry = row as WooSyncHistoryEntry;
  return {
    ...entry,
    changed_fields: Array.isArray(entry.changed_fields) ? entry.changed_fields : [],
    payload_summary: entry.payload_summary ?? {},
    image_summary: entry.image_summary ?? {},
  };
}

export async function getWooSyncHistoryForProduct(productId: string, limit = 20) {
  const { data, error } = await supabase
    .from("woocommerce_sync_history")
    .select(HISTORY_SELECT)
    .eq("product_id", productId)
    .order("synced_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []).map(asHistoryEntry);
}
