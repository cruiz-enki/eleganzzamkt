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

type FunctionPayload = Partial<WooConnectionResult> | null | undefined;

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
