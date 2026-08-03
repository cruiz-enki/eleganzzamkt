import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";
import { upsertMueble, uploadToDrive } from "./inventory.functions";

const muebleSchema = z.object({
  nombre: z.string(),
  categoria: z.string().optional().nullable(),
  precio: z.number().optional().nullable(),
  precio_2: z.number().optional().nullable(),
  precio_3: z.number().optional().nullable(),
  fotos: z.array(z.any()).optional().nullable(),
  descripcion: z.string().optional().nullable(),
  detalles: z.any().optional().nullable(),
});

export const importCSVInventory = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.array(muebleSchema).parse(data))
  .handler(async ({ data }) => {
    const results = [];
    const errors = [];

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      if (!item) continue;
      try {
        // 1. Crear el producto y su carpeta en Drive usando upsertMueble
        const savedProduct = await upsertMueble({ data: item });
        
        // 2. Si tiene una foto externa en el CSV, descargarla y subirla a su nueva carpeta de Drive
        if (item.fotos && item.fotos.length > 0 && item.fotos[0].url && item.fotos[0].url.startsWith('http')) {
          const imageUrl = item.fotos[0].url;
          const folderId = savedProduct.detalles?.google_drive_folder_id;

          if (folderId) {
            try {
              // Descargar la imagen
              const imageRes = await fetch(imageUrl);
              if (imageRes.ok) {
                const arrayBuffer = await imageRes.arrayBuffer();
                const base64 = Buffer.from(arrayBuffer).toString('base64');
                const contentType = imageRes.headers.get('content-type') || 'image/jpeg';
                const extension = contentType.split('/')[1] || 'jpg';
                
                // Subir a Drive
                const uploaded = await uploadToDrive({
                  data: {
                    fileName: `${savedProduct.nombre.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_import.${extension}`,
                    mimeType: contentType,
                    base64,
                    folderId,
                  }
                });

                // Actualizar el producto con la nueva URL de Drive
                const finalProduct = await upsertMueble({
                  data: {
                    ...savedProduct,
                    fotos: [uploaded]
                  }
                });
                results.push(finalProduct);
                continue;
              }
            } catch (uploadErr) {
              console.error(`Error uploading image for ${item.nombre}:`, uploadErr);
              // Si falla la subida de imagen, al menos ya tenemos el producto guardado
            }
          }
        }
        
        results.push(savedProduct);
      } catch (error: any) {
        console.error(`Error importing item ${item.nombre}:`, error);
        errors.push({ name: item.nombre, error: error.message });
      }
    }

    return { 
      success: errors.length === 0, 
      count: results.length, 
      errors: errors.length > 0 ? errors : null 
    };
  });
