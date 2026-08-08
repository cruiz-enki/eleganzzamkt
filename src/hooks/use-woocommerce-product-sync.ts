import { useMutation } from "@tanstack/react-query";
import { syncProductToWooCommerce } from "@/lib/api/woocommerce";

export function useWooCommerceProductSync() {
  return useMutation({
    mutationFn: (productId: string) => syncProductToWooCommerce(productId),
  });
}
