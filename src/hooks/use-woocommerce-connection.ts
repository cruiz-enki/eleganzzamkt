import { useMutation } from "@tanstack/react-query";
import { testWooCommerceConnection } from "@/lib/api/woocommerce";

export function useWooCommerceConnection() {
  return useMutation({
    mutationFn: testWooCommerceConnection,
  });
}
