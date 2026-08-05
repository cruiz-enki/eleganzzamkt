import { supabase } from "@/lib/supabase-client";

export type WooConnectionStatus = "untested" | "connected" | "error";

export type WooConnectionSuccess = {
  success: true;
  status: number;
  storeUrl: string;
  message: string;
  checkedAt: string;
};

export type WooConnectionFailure = {
  success: false;
  status: number;
  errorCode: string;
  message: string;
  checkedAt: string;
};

export type WooConnectionResult = WooConnectionSuccess | WooConnectionFailure;

export type WooProductSyncSuccess = {
  success: true;
  status: number;
  action: "created" | "updated";
  productId: string;
  wooProductId: number;
  permalink: string | null;
  imageSyncStatus?: "pending" | "skipped" | "synced" | "failed";
  imageSyncMessage?: string;
  message: string;
  syncedAt: string;
};

export type WooProductSyncFailure = {
  success: false;
  status: number;
  errorCode: string;
  message: string;
  syncedAt: string;
};

export type WooProductSyncResult = WooProductSyncSuccess | WooProductSyncFailure;

type FunctionPayload = Partial<WooConnectionResult> | null | undefined;
type ProductSyncPayload = Partial<WooProductSyncResult> | null | undefined;

function isFailurePayload(payload: FunctionPayload): payload is WooConnectionFailure {
  return (
    payload?.success === false &&
    typeof payload.status === "number" &&
    typeof payload.errorCode === "string" &&
    typeof payload.message === "string" &&
    typeof payload.checkedAt === "string"
  );
}

export function transformWooConnectionError(error: unknown, payload?: FunctionPayload) {
  if (isFailurePayload(payload)) return payload;

  const message = error instanceof Error ? error.message : "Error desconocido";
  const unauthorized = message.includes("401") || message.toLowerCase().includes("jwt");

  return {
    success: false,
    status: unauthorized ? 401 : 500,
    errorCode: unauthorized ? "WOOCOMMERCE_AUTH_REQUIRED" : "WOOCOMMERCE_FUNCTION_ERROR",
    message: unauthorized
      ? "Se requiere una sesión válida de Supabase para probar WooCommerce"
      : "No fue posible ejecutar la prueba de conexión con WooCommerce",
    checkedAt: new Date().toISOString(),
  } satisfies WooConnectionFailure;
}

function isProductSyncFailurePayload(
  payload: ProductSyncPayload,
): payload is WooProductSyncFailure {
  return (
    payload?.success === false &&
    typeof payload.status === "number" &&
    typeof payload.errorCode === "string" &&
    typeof payload.message === "string" &&
    typeof payload.syncedAt === "string"
  );
}

async function readFunctionFailure(error: unknown): Promise<WooProductSyncFailure | null> {
  const context =
    typeof error === "object" && error ? (error as { context?: unknown }).context : null;
  if (!(context instanceof Response)) return null;

  const payload = (await context.json().catch(() => null)) as ProductSyncPayload & {
    code?: string;
  };
  if (isProductSyncFailurePayload(payload)) return payload;

  const message =
    typeof payload?.message === "string" ? payload.message : "No fue posible autenticar la sesión";
  const code = typeof payload?.code === "string" ? payload.code : "WOOCOMMERCE_FUNCTION_ERROR";

  return {
    success: false,
    status: context.status,
    errorCode:
      context.status === 401 || code.includes("AUTH")
        ? "WOOCOMMERCE_AUTH_REQUIRED"
        : "WOOCOMMERCE_FUNCTION_ERROR",
    message:
      context.status === 401
        ? "Inicia sesión en Supabase antes de sincronizar productos con WooCommerce"
        : message,
    syncedAt: new Date().toISOString(),
  };
}

export async function testWooCommerceConnection(): Promise<WooConnectionResult> {
  const { data, error } =
    await supabase.functions.invoke<WooConnectionResult>("woo-test-connection");

  if (error) {
    return transformWooConnectionError(error, data);
  }

  if (!data) {
    return transformWooConnectionError(new Error("Empty function response"));
  }

  return data;
}

export async function syncProductToWooCommerce(productId: string): Promise<WooProductSyncResult> {
  const { data, error } = await supabase.functions.invoke<WooProductSyncResult>(
    "woo-sync-product",
    {
      body: { productId },
    },
  );

  if (error) {
    if (isProductSyncFailurePayload(data)) return data;
    const functionFailure = await readFunctionFailure(error);
    if (functionFailure) return functionFailure;

    return {
      success: false,
      status: 500,
      errorCode: "WOOCOMMERCE_FUNCTION_ERROR",
      message: "No fue posible ejecutar la sincronización con WooCommerce",
      syncedAt: new Date().toISOString(),
    };
  }

  if (!data) {
    return {
      success: false,
      status: 500,
      errorCode: "WOOCOMMERCE_EMPTY_RESPONSE",
      message: "WooCommerce no devolvió respuesta de sincronización",
      syncedAt: new Date().toISOString(),
    };
  }

  return data;
}
