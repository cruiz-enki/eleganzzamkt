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

export async function uploadImage(file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
  const filePath = `muebles/${fileName}`;

  const { data, error } = await supabase.storage
    .from('assets')
    .upload(filePath, file);

  if (error) {
    console.error("Error uploading image:", error);
    throw new Error(error.message);
  }

  const { data: { publicUrl } } = supabase.storage
    .from('assets')
    .getPublicUrl(filePath);

  return publicUrl;
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
      // Crear carpeta en Google Drive para el nuevo producto
      const folderId = await createDriveFolder(data.nombre);
      
      const { data: result, error } = await supabase
        .from('muebles')
        .insert([{
          ...updateData,
          detalles: { 
            ...(typeof updateData.detalles === 'object' ? updateData.detalles : {}),
            google_drive_folder_id: folderId 
          }
        }])
        .select()
        .single();

      if (error) throw new Error(error.message);
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
