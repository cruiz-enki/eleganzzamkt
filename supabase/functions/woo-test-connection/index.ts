import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME = "woo-test-connection";
const REQUEST_TIMEOUT_MS = 10000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode =
  | "WOOCOMMERCE_CONFIG_MISSING"
  | "WOOCOMMERCE_INVALID_URL"
  | "WOOCOMMERCE_AUTH_REQUIRED"
  | "WOOCOMMERCE_ADMIN_REQUIRED"
  | "WOOCOMMERCE_AUTH_FAILED"
  | "WOOCOMMERCE_FORBIDDEN"
  | "WOOCOMMERCE_NOT_FOUND"
  | "WOOCOMMERCE_TIMEOUT"
  | "WOOCOMMERCE_NETWORK_ERROR"
  | "WOOCOMMERCE_INVALID_RESPONSE"
  | "WOOCOMMERCE_REQUEST_FAILED";

type JsonRecord = Record<string, unknown>;

function json(body: JsonRecord, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(status: number, errorCode: ErrorCode, message: string) {
  return json(
    {
      success: false,
      status,
      errorCode,
      message,
      checkedAt: new Date().toISOString(),
    },
    status,
  );
}

function normalizeStoreUrl(rawUrl: string) {
  const trimmed = rawUrl.trim().replace(/\/+$/, "");
  const parsed = new URL(trimmed);

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Unsupported protocol");
  }

  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";

  return parsed.toString().replace(/\/+$/, "");
}

function hasAdminRole(appMetadata: JsonRecord | null | undefined) {
  if (!appMetadata) return false;

  const role = appMetadata["role"];
  if (role === "admin" || role === "administrator") return true;

  const roles = appMetadata["roles"];
  if (Array.isArray(roles)) {
    return roles.some((value) => value === "admin" || value === "administrator");
  }

  return false;
}

function mapWooStatus(status: number): { errorCode: ErrorCode; message: string } {
  if (status === 401) {
    return {
      errorCode: "WOOCOMMERCE_AUTH_FAILED",
      message: "No fue posible autenticar la conexión con WooCommerce",
    };
  }

  if (status === 403) {
    return {
      errorCode: "WOOCOMMERCE_FORBIDDEN",
      message: "WooCommerce rechazó la conexión por permisos insuficientes",
    };
  }

  if (status === 404) {
    return {
      errorCode: "WOOCOMMERCE_NOT_FOUND",
      message: "No se encontró el endpoint de WooCommerce REST API v3",
    };
  }

  return {
    errorCode: "WOOCOMMERCE_REQUEST_FAILED",
    message: "WooCommerce respondió con un error al probar la conexión",
  };
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      response: errorResponse(
        401,
        "WOOCOMMERCE_AUTH_REQUIRED",
        "Se requiere una sesión válida de Supabase",
      ),
    };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false as const,
      response: errorResponse(
        500,
        "WOOCOMMERCE_CONFIG_MISSING",
        "La función no tiene configuradas las variables base de Supabase",
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false as const,
      response: errorResponse(
        401,
        "WOOCOMMERCE_AUTH_REQUIRED",
        "Se requiere una sesión válida de Supabase",
      ),
    };
  }

  if (!hasAdminRole(data.user.app_metadata as JsonRecord)) {
    return {
      ok: false as const,
      response: errorResponse(
        403,
        "WOOCOMMERCE_ADMIN_REQUIRED",
        "Tu usuario no tiene permisos administrativos para probar WooCommerce",
      ),
    };
  }

  return { ok: true as const };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return errorResponse(405, "WOOCOMMERCE_REQUEST_FAILED", "Método no permitido");
  }

  const adminCheck = await requireAdminUser(req);
  if (!adminCheck.ok) return adminCheck.response;

  const rawStoreUrl = Deno.env.get("WOOCOMMERCE_URL");
  const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

  if (!rawStoreUrl || !consumerKey || !consumerSecret) {
    return errorResponse(
      500,
      "WOOCOMMERCE_CONFIG_MISSING",
      "Faltan secretos de WooCommerce en Supabase",
    );
  }

  let storeUrl: string;
  try {
    storeUrl = normalizeStoreUrl(rawStoreUrl);
  } catch {
    return errorResponse(
      500,
      "WOOCOMMERCE_INVALID_URL",
      "La URL configurada para WooCommerce no es válida",
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);

  try {
    const response = await fetch(`${storeUrl}/wp-json/wc/v3/system_status`, {
      method: "GET",
      headers: {
        Authorization: `Basic ${credentials}`,
        Accept: "application/json",
        "User-Agent": `${FUNCTION_NAME}/1.0`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const mapped = mapWooStatus(response.status);
      return errorResponse(response.status, mapped.errorCode, mapped.message);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      return errorResponse(
        502,
        "WOOCOMMERCE_INVALID_RESPONSE",
        "WooCommerce respondió con un formato no JSON",
      );
    }

    try {
      await response.json();
    } catch {
      return errorResponse(
        502,
        "WOOCOMMERCE_INVALID_RESPONSE",
        "WooCommerce respondió con JSON inválido",
      );
    }

    return json({
      success: true,
      status: response.status,
      storeUrl,
      message: "WooCommerce conectado correctamente",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse(
        504,
        "WOOCOMMERCE_TIMEOUT",
        "La conexión con WooCommerce excedió el tiempo de espera",
      );
    }

    return errorResponse(
      502,
      "WOOCOMMERCE_NETWORK_ERROR",
      "No fue posible conectar con WooCommerce. Verifica DNS, SSL y disponibilidad de la tienda",
    );
  } finally {
    clearTimeout(timeout);
  }
});
