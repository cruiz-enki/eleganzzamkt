import { useQuery } from "@tanstack/react-query";
import {
  getSystemHealth,
  type SystemHealthItem,
  type SystemHealthResult,
} from "@/lib/api/system-health";
import { testWooCommerceConnection } from "@/lib/api/woocommerce";

function wooHealthFromError(error: unknown): SystemHealthItem {
  const message = error instanceof Error ? error.message : "No fue posible revisar WooCommerce";

  return {
    service: "woocommerce",
    label: "WooCommerce",
    status: "error",
    message,
    checkedAt: new Date().toISOString(),
  };
}

async function getWooCommerceHealth(): Promise<SystemHealthItem> {
  try {
    const result = await testWooCommerceConnection();

    return {
      service: "woocommerce",
      label: "WooCommerce",
      status: result.success ? "healthy" : "error",
      message: result.message,
      checkedAt: result.checkedAt,
      details: {
        estadoHttp: result.status,
        tienda: result.success ? result.storeUrl : null,
      },
    };
  } catch (error) {
    return wooHealthFromError(error);
  }
}

export function useSystemHealth() {
  return useQuery<SystemHealthResult>({
    queryKey: ["system-health"],
    queryFn: async () => {
      const [backend, wooCommerce] = await Promise.all([getSystemHealth(), getWooCommerceHealth()]);

      return {
        checkedAt: new Date().toISOString(),
        items: [...backend.items, wooCommerce],
      };
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
