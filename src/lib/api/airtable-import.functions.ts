/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";
import { upsertMueble, uploadToDrive } from "./inventory.functions";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/airtable";
const AIRTABLE_BASE_ID = "appOQZvn0cvA9boUZ";
const AIRTABLE_TABLE = "Total";

// Nombres de campo en Airtable (la pasarela de Lovable devuelve los campos por nombre).
const F_NOMBRE = "Nombre";
const F_CATEGORIA = "Categoría";
const F_PRECIO = "Precio";
const F_PRECIO_2 = "Precio 2";
const F_PRECIO_3 = "Precio 3";
const F_DESCRIPCION = "Descripción";
const F_FOTO_EDITADA = "Foto Editada";
const F_IMAGEN_ORIGINAL = "Imagen Original";

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

function extractImageUrls(fields: Record<string, any>): string[] {
  const fromField = (name: string): string[] => {
    const value = fields[name];
    if (!Array.isArray(value)) return [];
    return value
      .map((a) => (a && typeof a === "object" ? a.url : null))
      .filter(Boolean) as string[];
  };
  const edited = fromField(F_FOTO_EDITADA);
  // Preferimos la foto editada; si no hay, usamos la imagen original.
  return edited.length ? edited : fromField(F_IMAGEN_ORIGINAL);
}

type AirtableRecord = { id: string; fields: Record<string, any> };

async function fetchAllAirtableRecords(): Promise<AirtableRecord[]> {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const airtableApiKey = process.env["AIRTABLE_API_KEY"];

  if (!lovableApiKey || !airtableApiKey) {
    throw new Error(
      "El conector de Airtable no está configurado (faltan LOVABLE_API_KEY / AIRTABLE_API_KEY).",
    );
  }

  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  // Airtable devuelve máximo 100 registros por página; seguimos el cursor "offset".
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);

    const url = `${GATEWAY_URL}/v0/${encodeURIComponent(AIRTABLE_BASE_ID)}/${encodeURIComponent(
      AIRTABLE_TABLE,
    )}?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "X-Connection-Api-Key": airtableApiKey,
      },
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
 * 2. Descarga cada imagen de Airtable y la re-sube a Drive (URL permanente).
 * 3. Guarda las imágenes en fotos/galeria.
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

    const folderId = (saved.detalles as any)?.google_drive_folder_id as string | undefined;
    const galeria: Array<{ id: string; url: string }> = [];
    let uploaded = 0;
    let failed = 0;

    if (folderId && data.imageUrls && data.imageUrls.length > 0) {
      for (let i = 0; i < data.imageUrls.length; i++) {
        const imageUrl = data.imageUrls[i];
        if (!imageUrl || !imageUrl.startsWith("http")) continue;
        try {
          const imageRes = await fetch(imageUrl);
          if (!imageRes.ok) {
            failed++;
            continue;
          }
          const arrayBuffer = await imageRes.arrayBuffer();
          const base64 = Buffer.from(arrayBuffer).toString("base64");
          const rawType = imageRes.headers.get("content-type") || "image/jpeg";
          const contentType = rawType.split(";")[0] || "image/jpeg";
          const extension = contentType.split("/")[1] || "jpg";
          const safeName = data.nombre.replace(/[^a-z0-9]/gi, "_").toLowerCase();

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
          console.error(`Error subiendo imagen de ${data.nombre}:`, uploadErr);
          failed++;
        }
      }
    }

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
      totalImages: data.imageUrls?.length ?? 0,
    };
  });
