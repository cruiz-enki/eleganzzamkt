import { createServerFn } from "@tanstack/react-start";
import { createOpenAITextResponse } from "@/lib/api/openai";
import { downloadDriveFile } from "@/lib/api/google-drive";
import { z } from "zod";
import { requiereEditor, requiereSesion } from "@/lib/api/auth-middleware";

/**
 * Nota: Para una implementación real de extracción de muebles desde PDF
 * se requeriría un servicio de OCR y Visión Computarizada (como GPT-4o with Vision).
 * Por ahora, definimos la estructura para manejar los catálogos en Supabase y Drive.
 */

export const getCatalogos = createServerFn({ method: "GET" })
  .middleware([requiereSesion])
  .handler(async () => {
    const { supabaseAdmin: supabase } = await import("@/lib/supabase-admin");
    const { data, error } = await supabase
      .from("catalogos")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  });

export const createCatalogo = createServerFn({ method: "POST" })
  .middleware([requiereEditor])
  .inputValidator((data) =>
    z
      .object({
        nombre: z.string(),
        pdf_url: z.string(),
        drive_folder_id: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: supabase } = await import("@/lib/supabase-admin");
    const { data: newCatalogo, error } = await supabase
      .from("catalogos")
      .insert([data])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return newCatalogo;
  });

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function extractDriveId(url: string): string | null {
  const patterns = [/[?&]id=([\w-]+)/, /\/file\/d\/([\w-]+)/, /\/d\/([\w-]+)/];
  for (const p of patterns) {
    const m = url.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export const extractProductsFromPDF = createServerFn({ method: "POST" })
  .middleware([requiereEditor])
  .inputValidator((data) =>
    z
      .object({
        catalogoId: z.string(),
        pdfUrl: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin: supabase } = await import("@/lib/supabase-admin");

    const fileId = extractDriveId(data.pdfUrl);
    if (!fileId) throw new Error("No se pudo identificar el PDF en Google Drive.");

    // 1. Descargar el PDF desde Drive
    const base64 = toBase64(await downloadDriveFile(fileId));

    // 2. Analizar el PDF con IA
    const content = await createOpenAITextResponse([
      {
        role: "system",
        content:
          "Eres un asistente que extrae productos de catálogos de muebles. Responde ÚNICAMENTE con un arreglo JSON válido, sin explicaciones ni bloques de código.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Analiza este catálogo y extrae todos los muebles. Devuelve un arreglo JSON donde cada elemento tenga: nombre (string), categoria (string), precio (número en MXN o null), descripcion (string breve), medidas (string o null), materiales (string o null).",
          },
          {
            type: "file",
            file: {
              filename: "catalogo.pdf",
              file_data: `data:application/pdf;base64,${base64}`,
            },
          },
        ],
      },
    ]);
    const cleaned = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("[");
    const end = cleaned.lastIndexOf("]");
    if (start === -1 || end === -1) {
      throw new Error("La IA no devolvió productos legibles del catálogo.");
    }

    let parsed: any[] = [];
    try {
      parsed = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      throw new Error("No se pudo interpretar la respuesta de la IA.");
    }

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { success: true, count: 0, message: "No se encontraron muebles en el catálogo." };
    }

    const rows = parsed.slice(0, 100).map((p) => ({
      nombre: String(p?.nombre ?? "Mueble sin nombre"),
      categoria: p?.categoria ? String(p.categoria) : null,
      precio: typeof p?.precio === "number" ? p.precio : Number(p?.precio) || null,
      descripcion: p?.descripcion ? String(p.descripcion) : null,
      detalles: {
        source_catalogo_id: data.catalogoId,
        status: "draft",
        medidas: p?.medidas ?? null,
        materiales: p?.materiales ?? null,
        extracted_at: new Date().toISOString(),
      },
    }));

    const { error } = await supabase.from("muebles").insert(rows);
    if (error) throw new Error(error.message);

    return {
      success: true,
      count: rows.length,
      message: `Se extrajeron ${rows.length} muebles como borrador.`,
    };
  });

export const publishProduct = createServerFn({ method: "POST" })
  .middleware([requiereEditor])
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin: supabase } = await import("@/lib/supabase-admin");

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
