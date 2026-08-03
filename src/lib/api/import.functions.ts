import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

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
    // Procesar en bloques de 100 para no saturar Supabase
    const BATCH_SIZE = 100;
    const results = [];
    const errors = [];

    for (let i = 0; i < data.length; i += BATCH_SIZE) {
      const batch = data.slice(i, i + BATCH_SIZE);
      const { data: inserted, error } = await supabase
        .from('muebles')
        .insert(batch)
        .select();

      if (error) {
        console.error(`Error importing batch ${i}:`, error);
        errors.push({ batch: i, error: error.message });
      } else {
        results.push(...(inserted || []));
      }
    }

    return { 
      success: errors.length === 0, 
      count: results.length, 
      errors: errors.length > 0 ? errors : null 
    };
  });
