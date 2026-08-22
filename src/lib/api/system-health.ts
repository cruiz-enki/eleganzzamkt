import { createServerFn } from "@tanstack/react-start";
import { driveRequest } from "@/lib/api/google-drive";
import { fetchWithTimeout } from "@/lib/api/google-drive";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { requiereSesion } from "@/lib/api/auth-middleware";

export type SystemHealthStatus = "healthy" | "warning" | "error";
export type SystemHealthService = "supabase" | "woocommerce" | "google_drive" | "openai";

export type SystemHealthItem = {
  service: SystemHealthService;
  label: string;
  status: SystemHealthStatus;
  message: string;
  checkedAt: string;
  latencyMs?: number;
  details?: Record<string, string | number | boolean | null>;
};

export type SystemHealthResult = {
  checkedAt: string;
  items: SystemHealthItem[];
};

const OPENAI_MODELS_URL = "https://api.openai.com/v1/models";

function checkedAt() {
  return new Date().toISOString();
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Error desconocido";
}

function elapsedSince(startedAt: number) {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

async function checkSupabase(): Promise<SystemHealthItem> {
  const startedAt = performance.now();
  const now = checkedAt();

  try {
    const { count, error } = await supabase
      .from("muebles")
      .select("id", { count: "exact", head: true });

    if (error) {
      return {
        service: "supabase",
        label: "Supabase",
        status: "error",
        message: "No fue posible consultar la base de datos",
        checkedAt: now,
        latencyMs: elapsedSince(startedAt),
      };
    }

    return {
      service: "supabase",
      label: "Supabase",
      status: "healthy",
      message: "Base de datos disponible",
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
      details: {
        productos: count ?? 0,
      },
    };
  } catch {
    return {
      service: "supabase",
      label: "Supabase",
      status: "error",
      message: "No fue posible conectar con Supabase",
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
    };
  }
}

async function checkOpenAI(): Promise<SystemHealthItem> {
  const startedAt = performance.now();
  const now = checkedAt();
  const apiKey = process.env["OPENAI_API_KEY"];
  const model = process.env["OPENAI_MODEL"] || "gpt-5.6-luna";

  if (!apiKey) {
    return {
      service: "openai",
      label: "OpenAI",
      status: "error",
      message: "Falta OPENAI_API_KEY en los secretos",
      checkedAt: now,
      details: { model },
    };
  }

  try {
    const response = await fetchWithTimeout(
      OPENAI_MODELS_URL,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
      },
      10000,
    );

    if (response.ok) {
      return {
        service: "openai",
        label: "OpenAI",
        status: "healthy",
        message: "API disponible",
        checkedAt: now,
        latencyMs: elapsedSince(startedAt),
        details: { model },
      };
    }

    return {
      service: "openai",
      label: "OpenAI",
      status: response.status === 429 ? "warning" : "error",
      message:
        response.status === 401
          ? "La API key de OpenAI no fue aceptada"
          : response.status === 429
            ? "OpenAI respondió con límite de uso o velocidad"
            : `OpenAI respondió con estado ${response.status}`,
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
      details: { model },
    };
  } catch {
    return {
      service: "openai",
      label: "OpenAI",
      status: "error",
      message: "No fue posible conectar con OpenAI",
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
      details: { model },
    };
  }
}

async function checkGoogleDrive(): Promise<SystemHealthItem> {
  const startedAt = performance.now();
  const now = checkedAt();

  try {
    const response = await driveRequest(
      "/about?fields=user(emailAddress),storageQuota(limit,usage)",
      { method: "GET" },
      10000,
    );
    const payload = (await response.json().catch(() => null)) as {
      user?: { emailAddress?: string };
      storageQuota?: { limit?: string; usage?: string };
    } | null;

    return {
      service: "google_drive",
      label: "Google Drive",
      status: "healthy",
      message: "Drive disponible",
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
      details: {
        cuenta: payload?.user?.emailAddress ?? null,
      },
    };
  } catch (error) {
    const message = errorMessage(error);
    const authFailed = message.includes("invalid_grant") || message.includes("[400]");

    return {
      service: "google_drive",
      label: "Google Drive",
      status: "error",
      message: authFailed
        ? "No fue posible autenticar Google Drive; revisa el refresh token"
        : "No fue posible conectar con Google Drive",
      checkedAt: now,
      latencyMs: elapsedSince(startedAt),
    };
  }
}

async function getWooSyncSignals() {
  const { data, error } = await supabase.from("muebles").select("detalles");

  if (error) return null;

  let syncedProducts = 0;
  let lastSyncedAt: string | null = null;
  let imageSyncFailures = 0;

  for (const row of data ?? []) {
    const details = row.detalles as { woocommerce?: Record<string, unknown> } | null;
    const woocommerce = details?.woocommerce;
    if (!woocommerce?.["productId"]) continue;

    syncedProducts += 1;
    const syncedAt = woocommerce?.["lastSyncedAt"];

    if (typeof syncedAt === "string" && (!lastSyncedAt || syncedAt > lastSyncedAt)) {
      lastSyncedAt = syncedAt;
    }

    if (woocommerce?.["imageSyncStatus"] === "failed") {
      imageSyncFailures += 1;
    }
  }

  return { syncedProducts, lastSyncedAt, imageSyncFailures };
}

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requiereSesion])
  .handler(async () => {
    const [supabaseHealth, openAIHealth, driveHealth, wooSignals] = await Promise.all([
      checkSupabase(),
      checkOpenAI(),
      checkGoogleDrive(),
      getWooSyncSignals(),
    ]);

    if (wooSignals) {
      supabaseHealth.details = {
        ...(supabaseHealth.details ?? {}),
        productosSincronizadosWoo: wooSignals.syncedProducts,
        ultimaSincronizacionWoo: wooSignals.lastSyncedAt,
        erroresImagenesWoo: wooSignals.imageSyncFailures,
      };
    }

    return {
      checkedAt: checkedAt(),
      items: [supabaseHealth, openAIHealth, driveHealth],
    } satisfies SystemHealthResult;
  });
