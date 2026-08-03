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
  .inputValidator((data) => z.object({
    catalogoId: z.string(),
    pdfUrl: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabase } = await import("@/lib/supabase-client");

    const lovableApiKey = process.env['LOVABLE_API_KEY'];
    const driveKey = process.env['GOOGLE_DRIVE_API_KEY'];
    if (!lovableApiKey) throw new Error("Falta LOVABLE_API_KEY en los secretos.");
    if (!driveKey) throw new Error("Falta la conexión de Google Drive.");

    const fileId = extractDriveId(data.pdfUrl);
    if (!fileId) throw new Error("No se pudo identificar el PDF en Google Drive.");

    // 1. Descargar el PDF desde Drive
    const dl = await fetch(
      `https://connector-gateway.lovable.dev/google_drive/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          'X-Connection-Api-Key': driveKey,
        },
      },
    );
    if (!dl.ok) {
      const text = await dl.text();
      throw new Error(`No se pudo descargar el PDF [${dl.status}]: ${text}`);
    }
    const base64 = toBase64(await dl.arrayBuffer());

    // 2. Analizar el PDF con IA
    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        'Lovable-API-Key': lovableApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "google/gemini-3.6-flash",
        messages: [
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
                text:
                  "Analiza este catálogo y extrae todos los muebles. Devuelve un arreglo JSON donde cada elemento tenga: nombre (string), categoria (string), precio (número en MXN o null), descripcion (string breve), medidas (string o null), materiales (string o null).",
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
        ],
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error(`AI Gateway error [${aiRes.status}]: ${text}`);
      throw new Error(`Error de IA [${aiRes.status}]: ${text}`);
    }

    const aiJson = await aiRes.json();
    const content: string = aiJson.choices?.[0]?.message?.content ?? "";
    const cleaned = content.replace(/```json/gi, "").replace(/```/g, "").trim();
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
