import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Nota: Para una implementación real de extracción de muebles desde PDF
 * se requeriría un servicio de OCR y Visión Computarizada (como GPT-4o with Vision).
 * Por ahora, definimos la estructura para manejar los catálogos en Supabase y Drive.
 */

export const getCatalogos = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabase } = await import("@/lib/supabase-client");
    const { data, error } = await supabase
      .from("catalogos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  });

export const createCatalogo = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    nombre: z.string(),
    pdf_url: z.string(),
    drive_folder_id: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/lib/supabase-client");
    const { data: newCatalogo, error } = await supabase
      .from("catalogos")
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return newCatalogo;
  });

export const extractProductsFromPDF = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    catalogoId: z.string(),
    pdfUrl: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/lib/supabase-client");
    const { generateMarketingCopy } = await import("./ai.functions");
    
    console.log("Procesando catálogo:", data.catalogoId);
    
    // 1. Simular la extracción de datos desde el PDF usando IA
    // En una implementación real, aquí descargaríamos el PDF, convertiríamos a imágenes y usaríamos GPT-4o Vision.
    // Para este MVP, simularemos que la IA encontró 2 productos de prueba que quedan en estado "borrador".
    
    const mockProducts = [
      {
        nombre: "Sofá Velvet Eleganzza (Borrador)",
        categoria: "Salas",
        precio: 15999,
        descripcion: "Sofá de terciopelo extraído del catálogo.",
        detalles: { 
          source_catalogo_id: data.catalogoId,
          status: "draft",
          extracted_at: new Date().toISOString()
        },
        fotos: ["https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=80&w=800"]
      },
      {
        nombre: "Mesa Comedor Nórdica (Borrador)",
        categoria: "Comedores",
        precio: 8500,
        descripcion: "Mesa de madera clara extraída del catálogo.",
        detalles: { 
          source_catalogo_id: data.catalogoId,
          status: "draft",
          extracted_at: new Date().toISOString()
        },
        fotos: ["https://images.unsplash.com/photo-1577145000247-a737ad733f9e?auto=format&fit=crop&q=80&w=800"]
      }
    ];

    // 2. Insertar en Supabase marcados como borrador
    const { error } = await supabase
      .from("muebles")
      .insert(mockProducts);

    if (error) throw new Error(error.message);
    
    return { success: true, message: "Productos extraídos y guardados como borrador. Por favor, revísalos en la sección de Productos." };
  });

export const publishProduct = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/lib/supabase-client");
    
    const { data: current } = await supabase
      .from("muebles")
      .select("detalles")
      .eq("id", data.id)
      .single();

    const newDetalles = { ...(current?.detalles || {}), status: "published" };

    const { error } = await supabase
      .from("muebles")
      .update({ detalles: newDetalles })
      .eq("id", data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
