const SUPABASE_URL =
  import.meta.env["VITE_SUPABASE_URL"] || "https://eqshiiiekxbpsdilckuv.supabase.co";

type ImageLike = {
  id?: unknown;
  url?: unknown;
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

export function getDisplayImageUrl(image: ImageLike | null | undefined) {
  if (!image) return "";

  if (isDriveId(image.id)) {
    return `${SUPABASE_URL}/functions/v1/woo-image-proxy/${image.id}.jpg`;
  }

  if (typeof image.url !== "string") return "";

  const driveId = extractDriveIdFromUrl(image.url);
  if (isDriveId(driveId)) {
    return `${SUPABASE_URL}/functions/v1/woo-image-proxy/${driveId}.jpg`;
  }

  return image.url;
}

export function getFirstDisplayImageUrl(images: unknown[] | null | undefined) {
  if (!Array.isArray(images)) return "";

  for (const image of images) {
    const url = getDisplayImageUrl(image as ImageLike);
    if (url) return url;
  }

  return "";
}
