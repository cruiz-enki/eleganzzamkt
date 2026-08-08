import { useQuery } from "@tanstack/react-query";
import { getWooSyncHistoryForProduct } from "@/lib/api/woocommerce-sync-history";

export function wooSyncHistoryQueryKey(productId: string | null | undefined) {
  return ["woocommerce-sync-history", productId];
}

export function useWooCommerceSyncHistory(productId: string | null | undefined) {
  return useQuery({
    queryKey: wooSyncHistoryQueryKey(productId),
    queryFn: () => getWooSyncHistoryForProduct(productId as string),
    enabled: Boolean(productId),
    refetchOnWindowFocus: false,
  });
}
