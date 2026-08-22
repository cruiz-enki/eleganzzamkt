const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || "https://eqshiiiekxbpsdilckuv.supabase.co";

type ImageLike = {
  id?: unknown;
  url?: unknown;
  name?: unknown;
  mimeType?: unknown;
};

function extractDriveIdFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const idParam = parsed.searchParams.get("id");
    if (idParam) return idParam;

    const drivePathMatch = parsed.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
    return drivePathMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

function isDriveId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{10,}$/.test(value);
}

export type ManagedImage = {
  original: ImageLike;
  displayUrl: string;
  sourceUrl: string;
  driveId: string | null;
  name: string;
  reason: string | null;
  sourceType: "drive" | "url" | "invalid";
};

export function inspectImage(image: ImageLike | null | undefined): ManagedImage {
  const empty = {
    original: image ?? {},
    displayUrl: "",
    sourceUrl: "",
    driveId: null,
    name: "Imagen sin datos",
    reason: "La imagen no tiene ID de Drive ni URL válida",
    sourceType: "invalid" as const,
  };

  if (!image) return empty;

  const name = typeof image.name === "string" && image.name.trim() ? image.name : "Imagen";
  const rawUrl = typeof image.url === "string" ? image.url : "";

  if (isDriveId(image.id)) {
    return {
      original: image,
      displayUrl: `${SUPABASE_URL}/functions/v1/woo-image-proxy/${image.id}.jpg`,
      sourceUrl: rawUrl || `https://drive.google.com/file/d/${image.id}/view`,
      driveId: image.id,
      name,
      reason: null,
      sourceType: "drive",
    };
  }

  if (!rawUrl) return { ...empty, original: image, name };

  const driveId = extractDriveIdFromUrl(rawUrl);
  if (isDriveId(driveId)) {
    return {
      original: image,
      displayUrl: `${SUPABASE_URL}/functions/v1/woo-image-proxy/${driveId}.jpg`,
      sourceUrl: rawUrl,
      driveId,
      name,
      reason: null,
      sourceType: "drive",
    };
  }

  try {
    const parsed = new URL(rawUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return {
        ...empty,
        original: image,
        sourceUrl: rawUrl,
        name,
        reason: "La URL no usa HTTP o HTTPS",
      };
    }

    return {
      original: image,
      displayUrl: parsed.toString(),
      sourceUrl: parsed.toString(),
      driveId: null,
      name,
      reason: null,
      sourceType: "url",
    };
  } catch {
    return {
      ...empty,
      original: image,
      sourceUrl: rawUrl,
      name,
      reason: "La URL no tiene un formato válido",
    };
  }
}

export function normalizeManagedImage(image: ImageLike | null | undefined) {
  const inspected = inspectImage(image);
  if (inspected.driveId) {
    return {
      ...(image ?? {}),
      id: inspected.driveId,
      url: `https://lh3.googleusercontent.com/d/${inspected.driveId}=w1000`,
    };
  }

  return image ?? {};
}

export function getDisplayImageUrl(image: ImageLike | null | undefined) {
  return inspectImage(image).displayUrl;
}

export function getFirstDisplayImageUrl(images: unknown[] | null | undefined) {
  if (!Array.isArray(images)) return "";

  for (const image of images) {
    const url = getDisplayImageUrl(image as ImageLike);
    if (url) return url;
  }

  return "";
}

/**
 * Quita imágenes repetidas de una lista, comparando por id de Drive (o por la
 * URL que se muestra, si no hay id).
 *
 * Hace falta porque un mueble guarda sus fotos en dos campos: `galeria` (todas)
 * y `fotos` (la portada, que es una copia de la primera). Al juntarlos para
 * mostrarlos, la misma imagen salía dos veces. Vive aquí para que el panel y el
 * portal del cliente usen exactamente el mismo criterio.
 */
export function uniqueImages<T>(images: T[] | null | undefined): T[] {
  if (!Array.isArray(images)) return [];

  const seen = new Set<string>();
  const unicas: T[] = [];

  for (const image of images) {
    const info = inspectImage(image as ImageLike);
    if (info.sourceType === "invalid") continue;
    const key = info.driveId || info.displayUrl;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    unicas.push(image);
  }

  return unicas;
}
