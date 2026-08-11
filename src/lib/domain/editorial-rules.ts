/**
 * FASE 6 — Reglas de negocio de seguridad editorial (fuente única).
 *
 * Estas funciones centralizan las reglas que impiden que contenido no validado
 * llegue por error a marketing/campañas/ecommerce. NO duplicar esta lógica en
 * componentes: importar desde aquí.
 *
 * Cada regla devuelve `EditorialCheck` con `ok` y una lista de `reasons`
 * (nivel "error" bloquea; nivel "warning" solo advierte). Decisión de diseño:
 * para NO romper el flujo actual de WooCommerce (productos que aún no tienen
 * el nuevo estado de verificación), la falta de verificación es "warning" en
 * ecommerce, pero es "error" (bloqueante) para marketing/campañas.
 */

export type EditorialLevel = "error" | "warning";
export type EditorialReason = { level: EditorialLevel; message: string };
export type EditorialCheck = { ok: boolean; reasons: EditorialReason[] };

export type AssetLike = {
  tipo?: string | null;
  estado_revision?: string | null;
  url?: string | null;
  drive_file_id?: string | null;
};

export type MuebleLike = {
  nombre?: string | null;
  precio?: number | null;
  categoria?: string | null;
  estado_verificacion?: string | null;
  fotos?: unknown[] | null;
  galeria?: unknown[] | null;
};

const REAL_PHOTO_TYPES = new Set(["foto_real", "original"]);

function assetHasFile(a: AssetLike): boolean {
  return Boolean((a.url && a.url.trim()) || (a.drive_file_id && a.drive_file_id.trim()));
}

/** Un asset editado/IA solo se considera aprobado si estado_revision === "aprobada". */
export function canUseAssetForMarketing(asset: AssetLike): EditorialCheck {
  const reasons: EditorialReason[] = [];
  if (!assetHasFile(asset)) {
    reasons.push({ level: "error", message: "La imagen no tiene archivo asociado." });
  }
  if (asset.estado_revision !== "aprobada") {
    reasons.push({
      level: "error",
      message: "La imagen todavía no está aprobada por Eleganzza.",
    });
  }
  return { ok: reasons.every((r) => r.level !== "error"), reasons };
}

/**
 * Un producto NO está listo para marketing si:
 *  - no está verificado por Eleganzza, o
 *  - no tiene al menos una foto real/original válida (no rechazada).
 */
export function canUseForMarketing(mueble: MuebleLike, assets: AssetLike[] = []): EditorialCheck {
  const reasons: EditorialReason[] = [];

  if (mueble.estado_verificacion !== "verificado") {
    reasons.push({
      level: "error",
      message: "Este contenido no puede aprobarse porque el producto todavía no ha sido verificado por Eleganzza.",
    });
  }

  const hasRealPhoto = assets.some(
    (a) =>
      REAL_PHOTO_TYPES.has(String(a.tipo)) &&
      a.estado_revision !== "rechazada" &&
      assetHasFile(a),
  );
  if (!hasRealPhoto) {
    reasons.push({
      level: "error",
      message: "El producto no tiene al menos una fotografía real/original válida.",
    });
  }

  return { ok: reasons.every((r) => r.level !== "error"), reasons };
}

/**
 * Una campaña puede publicarse solo si todos sus productos están verificados
 * y todos los assets utilizados están aprobados.
 */
export function canPublishCampaign(
  items: Array<{ mueble: MuebleLike; muebleAssets?: AssetLike[]; usedAssets?: AssetLike[] }>,
): EditorialCheck {
  const reasons: EditorialReason[] = [];
  if (items.length === 0) {
    reasons.push({ level: "warning", message: "La campaña no tiene productos asociados." });
  }
  for (const item of items) {
    const m = canUseForMarketing(item.mueble, item.muebleAssets ?? []);
    if (!m.ok) {
      reasons.push({
        level: "error",
        message: `"${item.mueble.nombre ?? "Producto"}": ${m.reasons.find((r) => r.level === "error")?.message ?? "no está listo."}`,
      });
    }
    for (const asset of item.usedAssets ?? []) {
      const a = canUseAssetForMarketing(asset);
      if (!a.ok) {
        reasons.push({
          level: "error",
          message: `"${item.mueble.nombre ?? "Producto"}": una imagen usada no está aprobada.`,
        });
      }
    }
  }
  return { ok: reasons.every((r) => r.level !== "error"), reasons };
}

/**
 * Antes de sincronizar a WooCommerce:
 *  - datos mínimos (nombre y precio),
 *  - al menos una imagen utilizable (no rechazada),
 *  - impedir sincronizar si la única imagen disponible está rechazada.
 * La verificación de Eleganzza es "warning" aquí (no bloquea) para no romper
 * el catálogo existente que aún no tiene el nuevo estado de verificación.
 */
export function canSyncToWooCommerce(mueble: MuebleLike, assets: AssetLike[] = []): EditorialCheck {
  const reasons: EditorialReason[] = [];

  if (!mueble.nombre || !mueble.nombre.trim()) {
    reasons.push({ level: "error", message: "El producto no tiene nombre." });
  }
  if (mueble.precio == null || Number.isNaN(mueble.precio) || mueble.precio <= 0) {
    reasons.push({ level: "error", message: "El producto no tiene un precio válido." });
  }

  // Imágenes: se aceptan assets tracked (no rechazados) o el legado galeria/fotos.
  const trackedUsable = assets.filter((a) => a.estado_revision !== "rechazada" && assetHasFile(a));
  const legacyImages = (mueble.galeria?.length ?? 0) + (mueble.fotos?.length ?? 0);
  if (trackedUsable.length === 0 && legacyImages === 0) {
    reasons.push({ level: "error", message: "El producto no tiene imágenes disponibles." });
  }

  const hasApproved = assets.some((a) => a.estado_revision === "aprobada" && assetHasFile(a));
  if (!hasApproved && trackedUsable.length > 0) {
    reasons.push({
      level: "warning",
      message: "Ninguna imagen está aprobada aún; se sincronizarán imágenes sin aprobación formal.",
    });
  }

  // Solo advertir si el estado de verificación ya está presente (post-migración).
  if (mueble.estado_verificacion != null && mueble.estado_verificacion !== "verificado") {
    reasons.push({
      level: "warning",
      message: "El producto no ha sido verificado por Eleganzza.",
    });
  }

  return { ok: reasons.every((r) => r.level !== "error"), reasons };
}

/** Utilidad: primer mensaje de error (para toasts). */
export function firstError(check: EditorialCheck): string | null {
  return check.reasons.find((r) => r.level === "error")?.message ?? null;
}
