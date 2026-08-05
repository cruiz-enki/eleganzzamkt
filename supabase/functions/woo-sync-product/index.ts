import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME = "woo-sync-product";
const REQUEST_TIMEOUT_MS = 20000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

type Mueble = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number | string | null;
  precio_2: number | string | null;
  precio_3: number | string | null;
  fotos: unknown[] | null;
  galeria: unknown[] | null;
  descripcion: string | null;
  detalles: JsonRecord | null;
};

type WooProductResponse = {
  id?: number;
  name?: string;
  permalink?: string;
  status?: string;
};

function json(body: JsonRecord, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(status: number, errorCode: string, message: string) {
  return json(
    {
      success: false,
      status,
      errorCode,
      message,
      syncedAt: new Date().toISOString(),
    },
    status,
  );
}

function normalizeStoreUrl(rawUrl: string) {
  const parsed = new URL(rawUrl.trim().replace(/\/+$/, ""));
  parsed.username = "";
  parsed.password = "";
  parsed.search = "";
  parsed.hash = "";
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Invalid protocol");
  return parsed.toString().replace(/\/+$/, "");
}

function hasAdminRole(appMetadata: JsonRecord | null | undefined) {
  if (!appMetadata) return false;

  const role = appMetadata["role"];
  if (role === "admin" || role === "administrator") return true;

  const roles = appMetadata["roles"];
  return Array.isArray(roles)
    ? roles.some((value) => value === "admin" || value === "administrator")
    : false;
}

async function requireAdminUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false as const,
      response: errorResponse(401, "WOOCOMMERCE_AUTH_REQUIRED", "Se requiere sesión Supabase"),
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
        "Faltan variables base de Supabase",
      ),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return {
      ok: false as const,
      response: errorResponse(401, "WOOCOMMERCE_AUTH_REQUIRED", "Se requiere sesión Supabase"),
    };
  }

  if (!hasAdminRole(data.user.app_metadata as JsonRecord)) {
    return {
      ok: false as const,
      response: errorResponse(
        403,
        "WOOCOMMERCE_ADMIN_REQUIRED",
        "Tu usuario no tiene permisos para sincronizar WooCommerce",
      ),
    };
  }

  return { ok: true as const };
}

async function readJsonBody(req: Request) {
  try {
    return (await req.json()) as { productId?: unknown };
  } catch {
    return {};
  }
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function asDetails(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function getExistingWooId(details: JsonRecord) {
  const woo = asDetails(details["woocommerce"]);
  const rawId = woo["productId"] ?? woo["id"];
  const parsed = asNumber(rawId);
  return parsed && parsed > 0 ? Math.trunc(parsed) : null;
}

function imageUrlFrom(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const url = (value as JsonRecord)["url"];
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function collectImages(product: Mueble) {
  const urls = new Set<string>();
  const allImages = [...(product.galeria ?? []), ...(product.fotos ?? [])];
  for (const image of allImages) {
    const url = imageUrlFrom(image);
    if (url) urls.add(url);
    if (urls.size >= 10) break;
  }

  return Array.from(urls).map((src, index) => ({
    src,
    name: `${product.nombre} ${index + 1}`,
    alt: product.nombre,
  }));
}

function buildDescription(product: Mueble) {
  const rows = [
    product.descripcion ?? "",
    product.precio_2 ? `Precio 2: ${product.precio_2}` : "",
    product.precio_3 ? `Precio 3: ${product.precio_3}` : "",
    product.categoria ? `Categoría Eleganzza: ${product.categoria}` : "",
  ].filter(Boolean);
  return rows.join("\n\n");
}

function buildWooPayload(product: Mueble) {
  const price = asNumber(product.precio);
  const details = asDetails(product.detalles);
  const currentWoo = asDetails(details["woocommerce"]);
  const status = typeof currentWoo["status"] === "string" ? currentWoo["status"] : "draft";

  return {
    name: product.nombre,
    type: "simple",
    status,
    catalog_visibility: "visible",
    regular_price: price !== null ? String(price) : undefined,
    description: buildDescription(product),
    short_description: product.descripcion ?? "",
    images: collectImages(product),
    manage_stock: false,
    meta_data: [
      { key: "eleganzza_supabase_id", value: product.id },
      { key: "eleganzza_categoria", value: product.categoria ?? "" },
      { key: "eleganzza_precio_2", value: product.precio_2 ?? "" },
      { key: "eleganzza_precio_3", value: product.precio_3 ?? "" },
      { key: "eleganzza_synced_at", value: new Date().toISOString() },
    ],
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function wooRequest(storeUrl: string, credentials: string, path: string, init: RequestInit) {
  const response = await fetchWithTimeout(`${storeUrl}/wp-json/wc/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `${FUNCTION_NAME}/1.0`,
      ...(init.headers ?? {}),
    },
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.toLowerCase().includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : await response.text();

  return { response, body };
}

function mapWooError(status: number) {
  if (status === 401) return "WOOCOMMERCE_AUTH_FAILED";
  if (status === 403) return "WOOCOMMERCE_FORBIDDEN";
  if (status === 404) return "WOOCOMMERCE_NOT_FOUND";
  return "WOOCOMMERCE_SYNC_FAILED";
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

  const { productId } = await readJsonBody(req);
  if (typeof productId !== "string" || !productId.trim()) {
    return errorResponse(400, "WOOCOMMERCE_INVALID_PRODUCT", "Falta el producto a sincronizar");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const rawStoreUrl = Deno.env.get("WOOCOMMERCE_URL");
  const consumerKey = Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
  const consumerSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");

  if (!supabaseUrl || !serviceRoleKey || !rawStoreUrl || !consumerKey || !consumerSecret) {
    return errorResponse(
      500,
      "WOOCOMMERCE_CONFIG_MISSING",
      "Faltan secretos para sincronizar WooCommerce",
    );
  }

  let storeUrl: string;
  try {
    storeUrl = normalizeStoreUrl(rawStoreUrl);
  } catch {
    return errorResponse(500, "WOOCOMMERCE_INVALID_URL", "La URL de WooCommerce no es válida");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  const { data: product, error: productError } = await supabaseAdmin
    .from("muebles")
    .select("*")
    .eq("id", productId)
    .single();

  if (productError || !product) {
    return errorResponse(404, "WOOCOMMERCE_PRODUCT_NOT_FOUND", "No se encontró el producto");
  }

  const mueble = product as Mueble;
  if (!mueble.nombre?.trim()) {
    return errorResponse(
      422,
      "WOOCOMMERCE_PRODUCT_INCOMPLETE",
      "El producto necesita nombre antes de sincronizar",
    );
  }

  const details = asDetails(mueble.detalles);
  const existingWooId = getExistingWooId(details);
  const payload = buildWooPayload(mueble);
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const syncedAt = new Date().toISOString();

  try {
    const path = existingWooId ? `/products/${existingWooId}` : "/products";
    const method = existingWooId ? "PUT" : "POST";
    const { response, body } = await wooRequest(storeUrl, credentials, path, {
      method,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return errorResponse(
        response.status,
        mapWooError(response.status),
        response.status === 401 || response.status === 403
          ? "WooCommerce rechazó la sincronización. Revisa permisos de la clave REST"
          : "WooCommerce respondió con un error al sincronizar el producto",
      );
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse(
        502,
        "WOOCOMMERCE_INVALID_RESPONSE",
        "WooCommerce no devolvió un producto válido",
      );
    }

    const wooProduct = body as WooProductResponse;
    if (!wooProduct.id) {
      return errorResponse(
        502,
        "WOOCOMMERCE_INVALID_RESPONSE",
        "WooCommerce no devolvió el ID del producto",
      );
    }

    const nextDetails = {
      ...details,
      woocommerce: {
        ...asDetails(details["woocommerce"]),
        productId: wooProduct.id,
        permalink: wooProduct.permalink ?? null,
        status: wooProduct.status ?? payload.status,
        lastSyncedAt: syncedAt,
        lastSyncAction: existingWooId ? "updated" : "created",
      },
    };

    const { error: updateError } = await supabaseAdmin
      .from("muebles")
      .update({ detalles: nextDetails })
      .eq("id", productId);

    if (updateError) {
      return errorResponse(
        500,
        "WOOCOMMERCE_METADATA_UPDATE_FAILED",
        "El producto se sincronizó, pero no se pudo guardar el ID de WooCommerce",
      );
    }

    return json({
      success: true,
      status: response.status,
      action: existingWooId ? "updated" : "created",
      productId,
      wooProductId: wooProduct.id,
      permalink: wooProduct.permalink ?? null,
      message: existingWooId
        ? "Producto actualizado en WooCommerce"
        : "Producto creado en WooCommerce como borrador",
      syncedAt,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse(504, "WOOCOMMERCE_TIMEOUT", "WooCommerce tardó demasiado");
    }

    return errorResponse(
      502,
      "WOOCOMMERCE_NETWORK_ERROR",
      "No fue posible conectar con WooCommerce para sincronizar el producto",
    );
  }
});
