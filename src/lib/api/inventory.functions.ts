import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

const GOOGLE_DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const ELEGANZZA_FOLDER_ID = "0AKMhdlaXwPtQUk9PVA";

function driveHeaders() {
  const lovableApiKey = process.env['LOVABLE_API_KEY'];
  const googleDriveApiKey = process.env['GOOGLE_DRIVE_API_KEY'];
  if (!lovableApiKey || !googleDriveApiKey) return null;
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    'X-Connection-Api-Key': googleDriveApiKey,
    'Content-Type': 'application/json',
  };
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function createDriveFolder(name: string): Promise<string | null> {
  const headers = driveHeaders();
  if (!headers) return null;
  try {
    const res = await fetchWithTimeout(`${GOOGLE_DRIVE_GATEWAY}/drive/v3/files?supportsAllDrives=true`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ELEGANZZA_FOLDER_ID],
      }),
    });
    if (!res.ok) {
      console.error(`Drive folder create failed [${res.status}]: ${await res.text()}`);
      return null;
    }
    const data = await res.json();
    return data.id ?? null;
  } catch (error) {
    console.error("Error creating Drive folder:", error);
    return null;
  }
}

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
  detalles: any | null;
  created_at: string;
};

export const getSupabaseInventory = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .order('created_at', { ascending: false });

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
    const headers = driveHeaders();
    if (!headers) throw new Error("Faltan credenciales de Google Drive");

    const targetFolderId = data.folderId || ELEGANZZA_FOLDER_ID;

    const boundary = "eleganzza" + Math.random().toString(16).slice(2);
    const metadata = JSON.stringify({ name: data.fileName, parents: [targetFolderId] });
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
      `--${boundary}\r\nContent-Type: ${data.mimeType}\r\nContent-Transfer-Encoding: base64\r\n\r\n${data.base64}\r\n` +
      `--${boundary}--`;

    const res = await fetchWithTimeout(
      `${GOOGLE_DRIVE_GATEWAY}/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true`,
      {
        method: 'POST',
        headers: {
          Authorization: headers.Authorization,
          'X-Connection-Api-Key': headers['X-Connection-Api-Key'],
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body,
      },
      45000,
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`Drive upload failed [${res.status}]: ${text}`);
      throw new Error(`Error al subir a Drive [${res.status}]: ${text}`);
    }

    const uploaded = await res.json();
    if (!uploaded.id) throw new Error("Drive no devolvió el ID del archivo");

    // Make it publicly readable so it can be embedded
    await fetchWithTimeout(
      `${GOOGLE_DRIVE_GATEWAY}/drive/v3/files/${uploaded.id}/permissions?supportsAllDrives=true`,
      { method: 'POST', headers, body: JSON.stringify({ role: 'reader', type: 'anyone' }) },
    ).catch((e) => console.error("Permission set failed:", e));

    return {
      id: uploaded.id as string,
      url: `https://drive.google.com/thumbnail?id=${uploaded.id}&sz=w1000`,
    };
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
      .from('muebles')
      .select('id, nombre, detalles');

    if (fetchError) throw new Error(fetchError.message);

    const nombresNormalizados = data.nombres.map(n => n.trim().toLowerCase());

    for (const record of (records || [])) {
      if (nombresNormalizados.includes(record.nombre.trim().toLowerCase())) {
        const detalles = { ...(record.detalles || {}), status: 'discontinued' };
        const { error: updateError } = await supabase
          .from('muebles')
          .update({ detalles })
          .eq('id', record.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    return { success: true, updatedCount };
  });

export const updateMuebleStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), status: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: current } = await supabase
      .from('muebles')
      .select('detalles')
      .eq('id', data.id)
      .single();

    const detalles = { ...(current?.detalles || {}), status: data.status };

    const { error } = await supabase
      .from('muebles')
      .update({ detalles })
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
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
        .from('muebles')
        .select('detalles, nombre')
        .eq('id', id)
        .single();

      let folderId = current?.detalles?.google_drive_folder_id;
      
      // Si no tiene carpeta (por ejemplo, importado de CSV sin carpeta), la creamos
      if (!folderId) {
        folderId = await createDriveFolder(updateData.nombre || current?.nombre || "Mueble sin nombre");
        if (folderId) {
          updateData.detalles = { 
            ...(current?.detalles || {}), 
            ...(updateData.detalles || {}), 
            google_drive_folder_id: folderId 
          };
        }
      }

      const { data: result, error } = await supabase
        .from('muebles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error("Supabase update error:", error);
        throw new Error(error.message);
      }
      return result as Mueble;
    }

    const existingDetalles = typeof updateData.detalles === 'object' && updateData.detalles !== null
      ? updateData.detalles
      : {};

    let folderId: string | null = existingDetalles.google_drive_folder_id ?? null;
    if (!folderId) {
      folderId = await createDriveFolder(updateData.nombre || "Nuevo Mueble");
    }

    const { data: result, error } = await supabase
      .from('muebles')
      .insert([{
        ...updateData,
        detalles: { ...existingDetalles, google_drive_folder_id: folderId },
      }])
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      if (error.code === "42501") {
        throw new Error("La base de datos no permite crear productos. Ejecuta el permiso INSERT para el rol anon en la tabla muebles.");
      }
      throw new Error(error.message);
    }
    return result as Mueble;
  });

export const deleteMueble = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from('muebles')
      .delete()
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });

export const bulkCleanupCategories = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data: muebles, error } = await supabase
      .from('muebles')
      .select('id, categoria');
    
    if (error) throw new Error(error.message);
    
    let updatedCount = 0;
    for (const mueble of (muebles || [])) {
      const normalized = normalizeCategory(mueble.categoria);
      if (normalized !== mueble.categoria) {
        const { error: updateError } = await supabase
          .from('muebles')
          .update({ categoria: normalized })
          .eq('id', mueble.id);
        
        if (!updateError) updatedCount++;
      }
    }
    
    return { success: true, updatedCount };
  });

async function listDriveImages(folderId: string): Promise<Array<{ id: string; url: string }>> {
  const headers = driveHeaders();
  if (!headers) throw new Error("Faltan credenciales de Google Drive");

  const results: Array<{ id: string; url: string }> = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: 'nextPageToken, files(id,name,mimeType)',
      pageSize: '200',
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'true',
      corpora: 'allDrives',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetchWithTimeout(`${GOOGLE_DRIVE_GATEWAY}/drive/v3/files?${params.toString()}`, {
      method: 'GET',
      headers,
    }, 30000);

    if (!res.ok) {
      const text = await res.text();
      console.error(`Drive list failed [${res.status}]: ${text}`);
      throw new Error(`Error al leer la carpeta de Drive [${res.status}]`);
    }

    const json = await res.json();
    for (const f of (json.files || [])) {
      results.push({ id: f.id, url: `https://drive.google.com/thumbnail?id=${f.id}&sz=w1000` });
    }
    pageToken = json.nextPageToken;
  } while (pageToken);

  return results;
}

function mergeGaleria(existing: any[], driveFiles: Array<{ id: string; url: string }>) {
  const current = Array.isArray(existing) ? existing : [];
  const known = new Set<string>();
  for (const item of current) {
    if (item?.id) known.add(String(item.id));
    if (typeof item?.url === 'string') {
      const match = item.url.match(/[-\w]{25,}/);
      if (match) known.add(match[0]);
    }
  }
  const nuevos = driveFiles.filter((f) => !known.has(f.id));
  return { galeria: [...current, ...nuevos], added: nuevos.length };
}

export const syncDriveGallery = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { data: record, error } = await supabase
      .from('muebles')
      .select('id, galeria, detalles')
      .eq('id', data.id)
      .single();

    if (error) throw new Error(error.message);

    const folderId = record?.detalles?.google_drive_folder_id;
    if (!folderId) throw new Error("Este producto no tiene una carpeta de Drive vinculada");

    const driveFiles = await listDriveImages(folderId);
    const { galeria, added } = mergeGaleria(record?.galeria || [], driveFiles);

    if (added > 0) {
      const { error: updateError } = await supabase
        .from('muebles')
        .update({ galeria })
        .eq('id', data.id);
      if (updateError) throw new Error(updateError.message);
    }

    return { success: true, added, total: galeria.length };
  });

export const syncAllDriveGalleries = createServerFn({ method: "POST" })
  .handler(async () => {
    const { data: records, error } = await supabase
      .from('muebles')
      .select('id, galeria, detalles');

    if (error) throw new Error(error.message);

    let productosActualizados = 0;
    let fotosAgregadas = 0;

    for (const record of (records || [])) {
      const folderId = (record as any)?.detalles?.google_drive_folder_id;
      if (!folderId) continue;
      try {
        const driveFiles = await listDriveImages(folderId);
        const { galeria, added } = mergeGaleria((record as any).galeria || [], driveFiles);
        if (added > 0) {
          const { error: updateError } = await supabase
            .from('muebles')
            .update({ galeria })
            .eq('id', (record as any).id);
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
