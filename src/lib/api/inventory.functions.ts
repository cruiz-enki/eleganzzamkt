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
  descripcion: z.string().optional().nullable(),
  detalles: z.any().optional().nullable(),
});

export const upsertMueble = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => muebleSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;

    if (id) {
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
      folderId = await createDriveFolder(data.nombre);
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
