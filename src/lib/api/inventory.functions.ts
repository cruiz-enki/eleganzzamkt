/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { createDriveFolder, listDriveImages, uploadBase64ToDrive } from "@/lib/api/google-drive";
import { z } from "zod";

export type Mueble = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number | null;
  precio_2: number | null;
  precio_3: number | null;
  fotos: any[] | null;
  galeria: any[] | null;
  descripcion: string | null;
  marca: string | null;
  materiales: string | null;
  colores: string | null;
  medidas: string | null;
  detalles: any | null;
  created_at: string;
};

export const getSupabaseInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabase
    .from("muebles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching Supabase inventory:", error);
    throw new Error(error.message);
  }

  return data as Mueble[];
});

const uploadSchema = z.object({
  fileName: z.string(),
  mimeType: z.string(),
  base64: z.string(),
  folderId: z.string().optional().nullable(),
});

export const uploadToDrive = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadSchema.parse(data))
  .handler(async ({ data }) => {
    return uploadBase64ToDrive({ ...data, folderId: data.folderId ?? null });
  });

const muebleSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1),
  categoria: z.string().optional().nullable(),
  precio: z.number().optional().nullable(),
  precio_2: z.number().optional().nullable(),
  precio_3: z.number().optional().nullable(),
  fotos: z.array(z.any()).optional().nullable(),
  galeria: z.array(z.any()).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  marca: z.string().optional().nullable(),
  materiales: z.string().optional().nullable(),
  colores: z.string().optional().nullable(),
  medidas: z.string().optional().nullable(),
  detalles: z.any().optional().nullable(),
});

const normalizeCategory = (cat: string | null | undefined): string | null => {
  if (!cat) return null;
  const normalized = cat.trim().toLowerCase();
  if (normalized === "sala" || normalized === "salas") return "Salas";
  if (normalized === "comedor" || normalized === "comedores") return "Comedores";
  if (normalized === "cubrecama" || normalized === "set de cubrecama") return "Cubrecamas";

  // Default: capitalize first letter
  return cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1);
};

export const bulkDiscontinueMuebles = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ nombres: z.array(z.string()) }).parse(data))
  .handler(async ({ data }) => {
    let updatedCount = 0;

    // Buscamos los muebles por nombre (insensible a mayúsculas/minúsculas y trim)
    const { data: records, error: fetchError } = await supabase
      .from("muebles")
      .select("id, nombre, detalles");

    if (fetchError) throw new Error(fetchError.message);

    const nombresNormalizados = data.nombres.map((n) => n.trim().toLowerCase());

    for (const record of records || []) {
      if (nombresNormalizados.includes(record.nombre.trim().toLowerCase())) {
        const detalles = { ...(record.detalles || {}), status: "discontinued" };
        const { error: updateError } = await supabase
          .from("muebles")
          .update({ detalles })
          .eq("id", record.id);

        if (!updateError) updatedCount++;
      }
    }

    return { success: true, updatedCount };
  });

export const updateMuebleStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), status: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: current } = await supabase
      .from("muebles")
      .select("detalles")
      .eq("id", data.id)
      .single();

    const detalles = { ...(current?.detalles || {}), status: data.status };

    const { error } = await supabase.from("muebles").update({ detalles }).eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const updateMuebleGallery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ id: z.string(), galeria: z.array(z.any()) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { data: current, error: fetchError } = await supabase
      .from("muebles")
      .select("detalles")
      .eq("id", data.id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const firstImage = data.galeria[0] || null;
    const detalles = {
      ...(current?.detalles || {}),
      primary_image_id: firstImage?.id ?? null,
      primary_image_url: firstImage?.url ?? null,
      gallery_updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("muebles")
      .update({ galeria: data.galeria, detalles })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true, total: data.galeria.length };
  });

export const upsertMueble = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => muebleSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;

    // Normalizar categoría antes de guardar
    if (updateData.categoria) {
      updateData.categoria = normalizeCategory(updateData.categoria);
    }

    if (id) {
      // Si es una actualización, verificamos si ya tiene carpeta de Drive
      const { data: current } = await supabase
        .from("muebles")
        .select("detalles, nombre")
        .eq("id", id)
        .single();

      let folderId = current?.detalles?.google_drive_folder_id;

      // Si no tiene carpeta (por ejemplo, importado de CSV sin carpeta), la creamos
      if (!folderId) {
        folderId = await createDriveFolder(
          updateData.nombre || current?.nombre || "Mueble sin nombre",
        );
        if (folderId) {
          updateData.detalles = {
            ...(current?.detalles || {}),
            ...(updateData.detalles || {}),
            google_drive_folder_id: folderId,
          };
        }
      }

      const { data: result, error } = await supabase
        .from("muebles")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        throw new Error(error.message);
      }
      return result as Mueble;
    }

    const existingDetalles =
      typeof updateData.detalles === "object" && updateData.detalles !== null
        ? updateData.detalles
        : {};

    let folderId: string | null = existingDetalles.google_drive_folder_id ?? null;
    if (!folderId) {
      folderId = await createDriveFolder(updateData.nombre || "Nuevo Mueble");
    }

    const { data: result, error } = await supabase
      .from("muebles")
      .insert([
        {
          ...updateData,
          detalles: { ...existingDetalles, google_drive_folder_id: folderId },
        },
      ])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      if (error.code === "42501") {
        throw new Error(
          "La base de datos no permite crear productos. Ejecuta el permiso INSERT para el rol anon en la tabla muebles.",
        );
      }
      throw new Error(error.message);
    }
    return result as Mueble;
  });

export const deleteMueble = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase.from("muebles").delete().eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const bulkCleanupCategories = createServerFn({ method: "POST" }).handler(async () => {
  const { data: muebles, error } = await supabase.from("muebles").select("id, categoria");

  if (error) throw new Error(error.message);

  let updatedCount = 0;
  for (const mueble of muebles || []) {
    const normalized = normalizeCategory(mueble.categoria);
    if (normalized !== mueble.categoria) {
      const { error: updateError } = await supabase
        .from("muebles")
        .update({ categoria: normalized })
        .eq("id", mueble.id);

      if (!updateError) updatedCount++;
    }
  }

  return { success: true, updatedCount };
});

function driveIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/[-\w]{25,}/);
  return match ? match[0] : null;
}

function mergeGaleria(existing: any[], driveFiles: Array<{ id: string; url: string }>) {
  const current = (Array.isArray(existing) ? existing : []).map((item) => {
    const id = item?.id ?? driveIdFromUrl(item?.url);
    if (!id) return item;
    // Normalizamos a un formato de imagen que sí carga en el navegador
    return { ...item, id, url: `https://lh3.googleusercontent.com/d/${id}=w1000` };
  });
  const known = new Set<string>();
  for (const item of current) {
    if (item?.id) known.add(String(item.id));
    const fromUrl = driveIdFromUrl(item?.url);
    if (fromUrl) known.add(fromUrl);
  }
  const nuevos = driveFiles.filter((f) => !known.has(f.id));
  return { galeria: [...current, ...nuevos], added: nuevos.length };
}

export const syncDriveGallery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: record, error } = await supabase
      .from("muebles")
      .select("id, galeria, detalles")
      .eq("id", data.id)
      .single();

    if (error) throw new Error(error.message);

    const folderId = record?.detalles?.google_drive_folder_id;
    if (!folderId) throw new Error("Este producto no tiene una carpeta de Drive vinculada");

    const driveFiles = await listDriveImages(folderId);
    const { galeria, added } = mergeGaleria(record?.galeria || [], driveFiles);

    const cambio = added > 0 || JSON.stringify(galeria) !== JSON.stringify(record?.galeria || []);
    if (cambio) {
      const { error: updateError } = await supabase
        .from("muebles")
        .update({ galeria })
        .eq("id", data.id);
      if (updateError) throw new Error(updateError.message);
    }

    return { success: true, added, total: galeria.length };
  });

export const syncAllDriveGalleries = createServerFn({ method: "POST" }).handler(async () => {
  const { data: records, error } = await supabase.from("muebles").select("id, galeria, detalles");

  if (error) throw new Error(error.message);

  let productosActualizados = 0;
  let fotosAgregadas = 0;

  for (const record of records || []) {
    const folderId = (record as any)?.detalles?.google_drive_folder_id;
    if (!folderId) continue;
    try {
      const driveFiles = await listDriveImages(folderId);
      const { galeria, added } = mergeGaleria((record as any).galeria || [], driveFiles);
      const cambio =
        added > 0 || JSON.stringify(galeria) !== JSON.stringify((record as any).galeria || []);
      if (cambio) {
        const { error: updateError } = await supabase
          .from("muebles")
          .update({ galeria })
          .eq("id", (record as any).id);
        if (!updateError) {
          productosActualizados++;
          fotosAgregadas += added;
        }
      }
    } catch (e) {
      console.error(`Sync failed for ${(record as any).id}:`, e);
    }
  }

  return { success: true, productosActualizados, fotosAgregadas };
});
