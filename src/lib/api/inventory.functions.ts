import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

const GOOGLE_DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const ELEGANZZA_FOLDER_ID = "0AKMhdlaXwPtQUk9PVA";

async function createDriveFolder(name: string) {
  const lovableApiKey = process.env['LOVABLE_API_KEY'];
  const googleDriveApiKey = process.env['GOOGLE_DRIVE_API_KEY'];

  if (!lovableApiKey || !googleDriveApiKey) {
    console.error("Missing Google Drive credentials");
    return null;
  }

  try {
    const response = await fetch(`${GOOGLE_DRIVE_GATEWAY}/files`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': googleDriveApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: name,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [ELEGANZZA_FOLDER_ID]
      })
    });

    const data = await response.json();
    return data.id;
  } catch (error) {
    console.error("Error creating Drive folder:", error);
    return null;
  }
}

export async function uploadToDrive(file: File, folderId: string) {
  const lovableApiKey = process.env['LOVABLE_API_KEY'];
  const googleDriveApiKey = process.env['GOOGLE_DRIVE_API_KEY'];

  // Fallback to main folder if no specific folderId is provided (e.g., new product)
  const targetFolderId = folderId || ELEGANZZA_FOLDER_ID;

  if (!lovableApiKey || !googleDriveApiKey) {
    throw new Error("Missing Google Drive credentials");
  }

  try {
    // 1. Convert File to Base64
    const buffer = await file.arrayBuffer();
    const base64Content = btoa(
      new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    );

    // 2. Upload to Drive via Lovable Connector Gateway
    const response = await fetch(`https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': googleDriveApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        metadata: {
          name: file.name,
          parents: [targetFolderId]
        },
        content: base64Content
      })
    });

    const data = await response.json();
    if (!data.id) throw new Error("Failed to upload to Drive");

    // 3. Make file public (so it can be embedded)
    await fetch(`https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${data.id}/permissions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'X-Connection-Api-Key': googleDriveApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        role: 'reader',
        type: 'anyone'
      })
    });

    return data.id;
  } catch (error) {
    console.error("Error uploading to Drive:", error);
    throw error;
  }
}

export async function uploadImage(file: File) {
  // We'll keep this as a stub for compatibility or redirect to Drive logic if needed, 
  // but the component will now use uploadToDrive directly with the folderId.
  return ""; 
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

const muebleSchema = z.object({
  id: z.string().optional(),
  nombre: z.string(),
  categoria: z.string().optional().nullable(),
  precio: z.number().optional().nullable(),
  precio_2: z.number().optional().nullable(),
  precio_3: z.number().optional().nullable(),
  fotos: z.array(z.any()).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  detalles: z.any().optional().nullable(),
});

export const upsertMueble = createServerFn({ method: "POST" })
  .validator((data: unknown) => muebleSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;
    
    if (id) {
      const { data: result, error } = await supabase
        .from('muebles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return result as Mueble;
    } else {
      // 1. Crear la carpeta en Google Drive para el nuevo producto
      const folderId = await createDriveFolder(data.nombre).catch(err => {
        console.error("Folder creation failed but continuing:", err);
        return null;
      });
      
      // 2. Preparar los datos del mueble con el ID de la carpeta
      const muebleData = {
        ...updateData,
        detalles: { 
          ...(typeof updateData.detalles === 'object' ? updateData.detalles : {}),
          google_drive_folder_id: folderId || null 
        }
      };

      // 3. Insertar en Supabase
      const { data: result, error } = await supabase
        .from('muebles')
        .insert([muebleData])
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        throw new Error(error.message);
      }
      return result as Mueble;
    }
  });

export const deleteMueble = createServerFn({ method: "POST" })
  .validator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from('muebles')
      .delete()
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
