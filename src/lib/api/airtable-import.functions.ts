/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { z } from "zod";
import { upsertMueble, uploadToDrive } from "./inventory.functions";
import { checkDriveAccess } from "./google-drive";

const AIRTABLE_BASE_ID = "appOQZvn0cvA9boUZ";
const AIRTABLE_TABLE = "Total";

// Nombres de campo en Airtable (la API de Airtable devuelve los campos por nombre).
const F_NOMBRE = "Nombre";
const F_CATEGORIA = "Categoría";
const F_PRECIO = "Precio";
const F_PRECIO_2 = "Precio 2";
const F_PRECIO_3 = "Precio 3";
const F_DESCRIPCION = "Descripción";
const F_FOTO_EDITADA = "Foto Editada";
const F_IMAGEN_ORIGINAL = "Imagen Original";

// Todos los campos de adjuntos con fotos del producto. Se importan TODAS las
// imágenes de todos estos campos (antes solo se tomaba uno de los dos).
// "Foto Editada" va primero para que la portada sea la versión editada.
const IMAGE_FIELDS = [F_FOTO_EDITADA, F_IMAGEN_ORIGINAL] as const;

// Mapeo de categorías de Airtable hacia la taxonomía de la app.
// upsertMueble vuelve a normalizar (Sala->Salas, Comedor->Comedores, Cubrecama->Cubrecamas),
// así que aquí solo resolvemos los nombres que no coinciden.
const CATEGORY_MAP: Record<string, string> = {
  "cubre cama": "Cubrecama",
  cubrecama: "Cubrecama",
  "set de cubrecama": "Set de Cubrecama",
  accesorios: "Accesorios",
  "línea hotelier": "Edredón",
  "linea hotelier": "Edredón",
  frazada: "Frazada",
  sala: "Sala",
  comedor: "Comedor",
  recámara: "Recámara",
  recamara: "Recámara",
  cama: "Cama",
};

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function mapCategory(raw: unknown): string | null {
  const cat = typeof raw === "object" && raw !== null ? (raw as any).name : raw;
  if (!cat || typeof cat !== "string" || !cat.trim()) return null;
  const key = cat.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1);
}

function isJunkName(nombre: string): boolean {
  return !nombre.trim() || /^IMG[-_].*\.(jpe?g|png)$/i.test(nombre.trim());
}

/**
 * Junta las imágenes de TODOS los campos de adjuntos del registro
 * ("Foto Editada" + "Imagen Original"), sin duplicados.
 * Antes solo se usaba "Foto Editada" y, si estaba vacía, "Imagen Original";
 * ahora se importan todas las fotos que tenga el mueble en Airtable.
 */
function extractImageUrls(fields: Record<string, any>): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  for (const fieldName of IMAGE_FIELDS) {
    const value = fields[fieldName];
    if (!Array.isArray(value)) continue;

    for (const attachment of value) {
      if (!attachment || typeof attachment !== "object") continue;
      const url = typeof attachment.url === "string" ? attachment.url : null;
      if (!url) continue;

      // Si el mismo archivo está en los dos campos (mismo nombre y tamaño),
      // lo contamos una sola vez.
      const key =
        attachment.filename && attachment.size
          ? `${attachment.filename}|${attachment.size}`
          : (attachment.id ?? url);
      if (seen.has(key)) continue;
      seen.add(key);
      urls.push(url);
    }
  }

  return urls;
}

type AirtableRecord = { id: string; fields: Record<string, any> };

function getAirtableToken(): string {
  // Token personal de Airtable (Personal Access Token). Se conecta directo a la
  // API de Airtable, sin depender de la pasarela de Lovable.
  const airtableToken =
    process.env["AIRTABLE_API_KEY"] || process.env["AIRTABLE_TOKEN"] || process.env["AIRTABLE_PAT"];

  if (!airtableToken) {
    throw new Error(
      "Falta el token de Airtable. Agrega AIRTABLE_API_KEY (un Personal Access Token de Airtable) a las variables de entorno.",
    );
  }

  return airtableToken;
}

async function fetchAllAirtableRecords(): Promise<AirtableRecord[]> {
  const airtableToken = getAirtableToken();

  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  // Airtable devuelve máximo 100 registros por página; seguimos el cursor "offset".
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);

    const url = `https://api.airtable.com/v0/${encodeURIComponent(
      AIRTABLE_BASE_ID,
    )}/${encodeURIComponent(AIRTABLE_TABLE)}?${params.toString()}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${airtableToken}` },
    });

    if (!response.ok) {
      throw new Error(`Airtable request failed [${response.status}]: ${await response.text()}`);
    }

    const payload = (await response.json()) as { records?: AirtableRecord[]; offset?: string };
    all.push(...(payload.records ?? []));
    offset = payload.offset;
  } while (offset);

  return all;
}

/**
 * Relee UN registro de Airtable. Las URLs de los adjuntos son firmadas y
 * caducan en ~2 horas, así que las refrescamos justo antes de descargarlas
 * (una importación larga tardaba más que la vigencia de las URLs).
 */
async function fetchAirtableRecord(recordId: string): Promise<AirtableRecord | null> {
  try {
    const url = `https://api.airtable.com/v0/${encodeURIComponent(
      AIRTABLE_BASE_ID,
    )}/${encodeURIComponent(AIRTABLE_TABLE)}/${encodeURIComponent(recordId)}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${getAirtableToken()}` },
    });

    if (!response.ok) return null;
    return (await response.json()) as AirtableRecord;
  } catch (error) {
    console.error(`No se pudo releer el registro ${recordId} de Airtable:`, error);
    return null;
  }
}

/**
 * Descarga cada imagen de Airtable y la re-sube a Drive (URL permanente).
 * Devuelve la galería resultante y el conteo de éxitos/fallos.
 */
async function uploadImagesToDrive(
  nombre: string,
  folderId: string,
  imageUrls: string[],
): Promise<{ galeria: Array<{ id: string; url: string }>; uploaded: number; failed: number }> {
  const galeria: Array<{ id: string; url: string }> = [];
  let uploaded = 0;
  let failed = 0;

  for (let i = 0; i < imageUrls.length; i++) {
    const imageUrl = imageUrls[i];
    if (!imageUrl || !imageUrl.startsWith("http")) continue;
    try {
      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) {
        console.error(`Airtable devolvió ${imageRes.status} al descargar imagen de ${nombre}`);
        failed++;
        continue;
      }
      const arrayBuffer = await imageRes.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const rawType = imageRes.headers.get("content-type") || "image/jpeg";
      const contentType = rawType.split(";")[0] || "image/jpeg";
      const extension = contentType.split("/")[1] || "jpg";
      const safeName = nombre.replace(/[^a-z0-9]/gi, "_").toLowerCase();

      const up = await uploadToDrive({
        data: {
          fileName: `${safeName}_${i + 1}.${extension}`,
          mimeType: contentType,
          base64,
          folderId,
        },
      });
      galeria.push(up);
      uploaded++;
    } catch (uploadErr) {
      console.error(`Error subiendo imagen de ${nombre}:`, uploadErr);
      failed++;
    }
  }

  return { galeria, uploaded, failed };
}

export type AirtableCandidate = {
  airtableId: string;
  nombre: string;
  categoria: string | null;
  categoriaOriginal: string | null;
  precio: number | null;
  precio_2: number | null;
  precio_3: number | null;
  descripcion: string | null;
  imageUrls: string[];
};

/**
 * Chequeo previo: ¿está viva la conexión con Google Drive?
 * Si no lo está, importar crearía productos sin ninguna imagen (en silencio),
 * que es justo lo que pasó en las importaciones del 18 y 21 de agosto.
 */
export const checkDriveConnection = createServerFn({ method: "GET" }).handler(async () => {
  return checkDriveAccess();
});

/**
 * Lee toda la tabla "Total" de Airtable, la compara contra los muebles ya existentes
 * (por nombre normalizado) y devuelve solo los candidatos nuevos, sin duplicados.
 * No escribe nada: solo devuelve la lista para que el usuario decida.
 */
export const getAirtableImportCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const [records, existing] = await Promise.all([
    fetchAllAirtableRecords(),
    supabase.from("muebles").select("nombre"),
  ]);

  if (existing.error) throw new Error(existing.error.message);

  const existingNames = new Set((existing.data ?? []).map((r) => normalizeName(r.nombre)));

  const seen = new Set<string>();
  const candidates: AirtableCandidate[] = [];
  let skippedExisting = 0;
  let skippedDuplicate = 0;
  let skippedJunk = 0;

  for (const rec of records) {
    const fields = rec.fields ?? {};
    const nombre = String(fields[F_NOMBRE] ?? "").trim();

    if (isJunkName(nombre)) {
      skippedJunk++;
      continue;
    }

    const key = normalizeName(nombre);
    if (existingNames.has(key)) {
      skippedExisting++;
      continue;
    }
    if (seen.has(key)) {
      skippedDuplicate++;
      continue;
    }
    seen.add(key);

    candidates.push({
      airtableId: rec.id,
      nombre,
      categoria: mapCategory(fields[F_CATEGORIA]),
      categoriaOriginal:
        typeof fields[F_CATEGORIA] === "object" && fields[F_CATEGORIA] !== null
          ? (fields[F_CATEGORIA].name ?? null)
          : (fields[F_CATEGORIA] ?? null),
      precio: typeof fields[F_PRECIO] === "number" ? fields[F_PRECIO] : null,
      precio_2: typeof fields[F_PRECIO_2] === "number" ? fields[F_PRECIO_2] : null,
      precio_3: typeof fields[F_PRECIO_3] === "number" ? fields[F_PRECIO_3] : null,
      descripcion: typeof fields[F_DESCRIPCION] === "string" ? fields[F_DESCRIPCION] : null,
      imageUrls: extractImageUrls(fields),
    });
  }

  candidates.sort(
    (a, b) =>
      (a.categoria ?? "").localeCompare(b.categoria ?? "") || a.nombre.localeCompare(b.nombre),
  );

  return {
    totalAirtable: records.length,
    existingCount: existingNames.size,
    skippedExisting,
    skippedDuplicate,
    skippedJunk,
    candidates,
  };
});

const candidateSchema = z.object({
  airtableId: z.string(),
  nombre: z.string().min(1),
  categoria: z.string().nullable().optional(),
  precio: z.number().nullable().optional(),
  precio_2: z.number().nullable().optional(),
  precio_3: z.number().nullable().optional(),
  descripcion: z.string().nullable().optional(),
  imageUrls: z.array(z.string()).optional().default([]),
});

/**
 * Importa UN candidato de Airtable a la tabla muebles:
 * 1. Crea el producto y su carpeta en Drive (vía upsertMueble).
 * 2. Relee el registro en Airtable para tener URLs de imagen frescas.
 * 3. Descarga cada imagen y la re-sube a Drive (URL permanente).
 * 4. Guarda las imágenes en fotos/galeria.
 * Se importa de uno en uno para poder mostrar progreso y evitar timeouts.
 */
export const importAirtableMueble = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => candidateSchema.parse(data))
  .handler(async ({ data }) => {
    // 1. Crear producto + carpeta de Drive
    const saved = await upsertMueble({
      data: {
        nombre: data.nombre,
        categoria: data.categoria ?? null,
        precio: data.precio ?? null,
        precio_2: data.precio_2 ?? null,
        precio_3: data.precio_3 ?? null,
        descripcion: data.descripcion ?? null,
        detalles: {
          source: "airtable_import",
          airtable_id: data.airtableId,
          imported_at: new Date().toISOString(),
        },
      },
    });

    // 2. URLs frescas de Airtable (las de la lista pueden haber caducado)
    let imageUrls = data.imageUrls ?? [];
    const fresh = await fetchAirtableRecord(data.airtableId);
    if (fresh) {
      const freshUrls = extractImageUrls(fresh.fields ?? {});
      if (freshUrls.length > 0) imageUrls = freshUrls;
    }

    const folderId = (saved.detalles as any)?.google_drive_folder_id as string | undefined;

    // Si Drive falló, avisamos en vez de guardar el producto sin fotos en silencio.
    if (!folderId && imageUrls.length > 0) {
      return {
        success: true,
        id: saved.id,
        nombre: data.nombre,
        uploaded: 0,
        failed: imageUrls.length,
        totalImages: imageUrls.length,
        imagesError:
          "No se pudo crear la carpeta en Google Drive, así que el producto quedó sin imágenes.",
      };
    }

    const { galeria, uploaded, failed } = folderId
      ? await uploadImagesToDrive(data.nombre, folderId, imageUrls)
      : { galeria: [] as Array<{ id: string; url: string }>, uploaded: 0, failed: 0 };

    let finalProduct = saved;
    if (galeria.length > 0) {
      finalProduct = await upsertMueble({
        data: {
          ...saved,
          fotos: [galeria[0]],
          galeria,
        },
      });
    }

    return {
      success: true,
      id: finalProduct.id,
      nombre: data.nombre,
      uploaded,
      failed,
      totalImages: imageUrls.length,
      imagesError:
        failed > 0 && uploaded === 0
          ? "Ninguna imagen se pudo subir a Google Drive."
          : (null as string | null),
    };
  });

export type AirtableRepairCandidate = {
  muebleId: string;
  airtableId: string;
  nombre: string;
  categoria: string | null;
  imageCount: number;
  imageUrls: string[];
};

/**
 * Busca los muebles que YA están en Supabase pero se quedaron sin ninguna
 * imagen, y que en Airtable sí tienen fotos. Empareja por `detalles.airtable_id`
 * y, si no lo tiene, por nombre normalizado.
 * No escribe nada: solo devuelve la lista.
 */
export const getAirtableImageRepairCandidates = createServerFn({ method: "GET" }).handler(
  async () => {
    const [records, existing] = await Promise.all([
      fetchAllAirtableRecords(),
      supabase.from("muebles").select("id, nombre, categoria, fotos, galeria, detalles"),
    ]);

    if (existing.error) throw new Error(existing.error.message);

    const byAirtableId = new Map<string, AirtableRecord>();
    const byName = new Map<string, AirtableRecord>();
    for (const rec of records) {
      byAirtableId.set(rec.id, rec);
      const key = normalizeName(rec.fields?.[F_NOMBRE]);
      if (key && !byName.has(key)) byName.set(key, rec);
    }

    const candidates: AirtableRepairCandidate[] = [];
    let sinImagenes = 0;
    let sinCoincidencia = 0;

    for (const row of existing.data ?? []) {
      const fotos = Array.isArray(row.fotos) ? row.fotos : [];
      const galeria = Array.isArray(row.galeria) ? row.galeria : [];
      if (fotos.length > 0 || galeria.length > 0) continue; // ya tiene imágenes

      sinImagenes++;

      const detalles = (row.detalles ?? {}) as any;
      const rec =
        (detalles.airtable_id ? byAirtableId.get(detalles.airtable_id) : undefined) ??
        byName.get(normalizeName(row.nombre));

      if (!rec) {
        sinCoincidencia++;
        continue;
      }

      const imageUrls = extractImageUrls(rec.fields ?? {});
      if (imageUrls.length === 0) {
        sinCoincidencia++;
        continue;
      }

      candidates.push({
        muebleId: row.id,
        airtableId: rec.id,
        nombre: row.nombre,
        categoria: row.categoria ?? null,
        imageCount: imageUrls.length,
        imageUrls,
      });
    }

    candidates.sort((a, b) => a.nombre.localeCompare(b.nombre));

    return { sinImagenes, sinCoincidencia, candidates };
  },
);

const repairSchema = z.object({
  muebleId: z.string(),
  airtableId: z.string(),
  nombre: z.string().min(1),
  imageUrls: z.array(z.string()).optional().default([]),
});

/**
 * Repara UN mueble ya existente: relee sus imágenes en Airtable, las sube a su
 * carpeta de Drive (creándola si hace falta) y las guarda en fotos/galeria.
 * No toca ningún otro dato del producto.
 */
export const repairAirtableMuebleImages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => repairSchema.parse(data))
  .handler(async ({ data }) => {
    // URLs frescas de Airtable (las firmadas caducan en ~2 h)
    let imageUrls = data.imageUrls ?? [];
    const fresh = await fetchAirtableRecord(data.airtableId);
    if (fresh) {
      const freshUrls = extractImageUrls(fresh.fields ?? {});
      if (freshUrls.length > 0) imageUrls = freshUrls;
    }

    if (imageUrls.length === 0) {
      throw new Error("Este producto ya no tiene imágenes en Airtable.");
    }

    // upsertMueble crea la carpeta de Drive si el producto aún no tiene una.
    const current = await upsertMueble({
      data: { id: data.muebleId, nombre: data.nombre },
    });

    const folderId = (current.detalles as any)?.google_drive_folder_id as string | undefined;
    if (!folderId) {
      throw new Error(
        "No se pudo crear la carpeta en Google Drive (revisa la conexión con Drive).",
      );
    }

    const { galeria, uploaded, failed } = await uploadImagesToDrive(
      data.nombre,
      folderId,
      imageUrls,
    );

    if (galeria.length === 0) {
      throw new Error("Ninguna imagen se pudo subir a Google Drive.");
    }

    await upsertMueble({
      data: {
        id: data.muebleId,
        nombre: data.nombre,
        fotos: [galeria[0]],
        galeria,
      },
    });

    return {
      success: true,
      id: data.muebleId,
      nombre: data.nombre,
      uploaded,
      failed,
      totalImages: imageUrls.length,
    };
  });
