import { createClient } from "npm:@supabase/supabase-js@2";

const FUNCTION_NAME = "woo-preview-product";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_IMAGES_PER_SYNC = 20;

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
  status?: string;
  permalink?: string;
  regular_price?: string;
  description?: string;
  short_description?: string;
  categories?: Array<{ id?: number; name?: string }>;
  images?: Array<{ id?: number; src?: string; name?: string; alt?: string }>;
};

type WooCategoryResponse = {
  id?: number;
  name?: string;
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
      previewedAt: new Date().toISOString(),
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

function asDetails(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function getExistingWooId(details: JsonRecord) {
  const woo = asDetails(details["woocommerce"]);
  const rawId = woo["productId"] ?? woo["id"];
  const parsed = asNumber(rawId);
  return parsed && parsed > 0 ? Math.trunc(parsed) : null;
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
        "Tu usuario no tiene permisos para previsualizar WooCommerce",
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

function imageFrom(
  value: unknown,
  supabaseUrl: string,
): { src: string; sourceId: string | null; originalUrl: string | null; name: string } | null {
  if (!value || typeof value !== "object") return null;
  const id = (value as JsonRecord)["id"];
  const url = (value as JsonRecord)["url"];

  if (typeof id === "string" && /^[A-Za-z0-9_-]{10,}$/.test(id)) {
    return {
      src: `${supabaseUrl}/functions/v1/woo-image-proxy/${id}.jpg`,
      sourceId: id,
      originalUrl: typeof url === "string" ? url : null,
      name: id,
    };
  }

  if (typeof url !== "string" || !/\.(jpe?g|png|webp)(\?|$)/i.test(url)) return null;

  try {
    const parsed = new URL(url);
    return ["http:", "https:"].includes(parsed.protocol)
      ? {
          src: parsed.toString(),
          sourceId: null,
          originalUrl: parsed.toString(),
          name: parsed.pathname.split("/").filter(Boolean).pop() ?? parsed.hostname,
        }
      : null;
  } catch {
    return null;
  }
}

function collectImages(product: Mueble, supabaseUrl: string) {
  const urls = new Set<string>();
  const images: Array<{
    src: string;
    name: string;
    alt: string;
    sourceId: string | null;
    originalUrl: string | null;
  }> = [];
  const allImages = [...(product.galeria ?? []), ...(product.fotos ?? [])];
  for (const image of allImages) {
    const nextImage = imageFrom(image, supabaseUrl);
    if (!nextImage || urls.has(nextImage.src)) continue;

    urls.add(nextImage.src);
    images.push({
      src: nextImage.src,
      name: `${product.nombre} ${images.length + 1}.jpg`,
      alt: product.nombre,
      sourceId: nextImage.sourceId,
      originalUrl: nextImage.originalUrl,
    });
    if (images.length >= MAX_IMAGES_PER_SYNC) break;
  }

  return images;
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

function buildWooPayload(product: Mueble, wooCategoryId: number | null) {
  const price = asNumber(product.precio);
  const details = asDetails(product.detalles);
  const currentWoo = asDetails(details["woocommerce"]);
  const status = typeof currentWoo["status"] === "string" ? currentWoo["status"] : "draft";

  return {
    name: product.nombre,
    type: "simple",
    status,
    catalog_visibility: "visible",
    regular_price: price !== null ? String(price) : null,
    description: buildDescription(product),
    short_description: product.descripcion ?? "",
    categories: wooCategoryId ? [{ id: wooCategoryId, name: product.categoria ?? "" }] : [],
    manage_stock: false,
    meta_data: [
      { key: "eleganzza_supabase_id", value: product.id },
      { key: "eleganzza_categoria", value: product.categoria ?? "" },
      { key: "eleganzza_precio_2", value: product.precio_2 ?? "" },
      { key: "eleganzza_precio_3", value: product.precio_3 ?? "" },
    ],
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
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

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("es-MX");
}

async function findWooCategory(
  storeUrl: string,
  credentials: string,
  categoryName: string | null,
) {
  const name = categoryName?.trim();
  if (!name) return { id: null, name: null, exists: false };

  const searchResult = await wooRequest(
    storeUrl,
    credentials,
    `/products/categories?search=${encodeURIComponent(name)}&per_page=100`,
    { method: "GET" },
  );

  if (!searchResult.response.ok || !Array.isArray(searchResult.body)) {
    throw new Error("WooCommerce no permitió buscar categorías");
  }

  const existing = (searchResult.body as WooCategoryResponse[]).find(
    (category) =>
      typeof category.name === "string" && normalizeName(category.name) === normalizeName(name),
  );

  return {
    id: existing?.id ?? null,
    name,
    exists: Boolean(existing?.id),
  };
}

function text(value: unknown) {
  return typeof value === "string" ? value : value === null || value === undefined ? null : String(value);
}

function stripHtml(value: string | null | undefined) {
  return (value ?? "").replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function sameText(left: unknown, right: unknown) {
  return (text(left) ?? "") === (text(right) ?? "");
}

function buildChanges(
  payload: ReturnType<typeof buildWooPayload>,
  localImages: ReturnType<typeof collectImages>,
  currentWoo: WooProductResponse | null,
  categoryInfo: Awaited<ReturnType<typeof findWooCategory>>,
) {
  if (!currentWoo) {
    return [
      { field: "producto", current: null, next: "Se creará un producto nuevo" },
      { field: "nombre", current: null, next: payload.name },
      { field: "precio", current: null, next: payload.regular_price },
      { field: "categoría", current: null, next: categoryInfo.name },
      { field: "imágenes", current: 0, next: localImages.length },
    ];
  }

  const currentCategory = currentWoo.categories?.[0] ?? null;
  const changes = [
    {
      field: "nombre",
      current: currentWoo.name ?? null,
      next: payload.name,
      changed: !sameText(currentWoo.name, payload.name),
    },
    {
      field: "estado",
      current: currentWoo.status ?? null,
      next: payload.status,
      changed: !sameText(currentWoo.status, payload.status),
    },
    {
      field: "precio",
      current: currentWoo.regular_price ?? null,
      next: payload.regular_price,
      changed: !sameText(currentWoo.regular_price, payload.regular_price),
    },
    {
      field: "categoría",
      current: currentCategory?.name ?? null,
      next: categoryInfo.name,
      changed: currentCategory?.id !== categoryInfo.id || !sameText(currentCategory?.name, categoryInfo.name),
    },
    {
      field: "descripción",
      current: stripHtml(currentWoo.description),
      next: stripHtml(payload.description),
      changed: stripHtml(currentWoo.description) !== stripHtml(payload.description),
    },
    {
      field: "imágenes",
      current: currentWoo.images?.length ?? 0,
      next: localImages.length,
      changed: (currentWoo.images?.length ?? 0) !== localImages.length,
    },
  ];

  return changes.filter((change) => change.changed);
}

function isWooProduct(body: unknown): body is WooProductResponse {
  return !!body && typeof body === "object" && !Array.isArray(body) && Boolean((body as WooProductResponse).id);
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
    return errorResponse(400, "WOOCOMMERCE_INVALID_PRODUCT", "Falta el producto a previsualizar");
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
      "Faltan secretos para previsualizar WooCommerce",
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
      "El producto necesita nombre antes de previsualizar",
    );
  }

  const details = asDetails(mueble.detalles);
  const existingWooId = getExistingWooId(details);
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);

  try {
    const category = await findWooCategory(storeUrl, credentials, mueble.categoria);
    const images = collectImages(mueble, supabaseUrl);
    const payload = buildWooPayload(mueble, category.id);

    let currentWoo: WooProductResponse | null = null;
    let currentWooStatus: number | null = null;
    if (existingWooId) {
      const currentResult = await wooRequest(storeUrl, credentials, `/products/${existingWooId}`, {
        method: "GET",
      });
      currentWooStatus = currentResult.response.status;
      if (currentResult.response.ok && isWooProduct(currentResult.body)) {
        currentWoo = currentResult.body;
      }
    }

    const changes = buildChanges(payload, images, currentWoo, category);

    return json({
      success: true,
      status: 200,
      storeUrl,
      action: existingWooId && currentWoo ? "updated" : "created",
      productId,
      wooProductId: existingWooId,
      currentWooFound: Boolean(currentWoo),
      currentWooStatus,
      permalink: currentWoo?.permalink ?? null,
      product: {
        nombre: mueble.nombre,
        descripcion: mueble.descripcion ?? "",
        precio: payload.regular_price,
        precio_2: mueble.precio_2 ?? null,
        precio_3: mueble.precio_3 ?? null,
        categoria: mueble.categoria ?? null,
        status: payload.status,
      },
      category: {
        name: category.name,
        id: category.id,
        exists: category.exists,
        willCreate: Boolean(category.name && !category.exists),
      },
      images: {
        total: images.length,
        max: MAX_IMAGES_PER_SYNC,
        items: images.map((image) => ({
          src: image.src,
          originalUrl: image.originalUrl,
          sourceId: image.sourceId,
          name: image.name,
          alt: image.alt,
        })),
      },
      changes,
      payloadPreview: {
        name: payload.name,
        status: payload.status,
        regular_price: payload.regular_price,
        description: payload.description,
        short_description: payload.short_description,
        categories: payload.categories,
        manage_stock: payload.manage_stock,
      },
      message:
        changes.length > 0
          ? `Se detectaron ${changes.length} cambio(s) para WooCommerce`
          : "No se detectaron cambios contra WooCommerce",
      previewedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return errorResponse(504, "WOOCOMMERCE_TIMEOUT", "WooCommerce tardó demasiado");
    }

    return errorResponse(
      502,
      "WOOCOMMERCE_PREVIEW_FAILED",
      error instanceof Error
        ? error.message
        : "No fue posible previsualizar la sincronización con WooCommerce",
    );
  }
});
