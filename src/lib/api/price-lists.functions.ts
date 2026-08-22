import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createOpenAITextResponse } from "@/lib/api/openai";

/**
 * Lectura de una lista de precios en PDF.
 *
 * Se manda el PDF completo al modelo (la integración de OpenAI ya acepta
 * archivos) en vez de agregar una librería de parseo: así también funcionan las
 * listas escaneadas, que las hay. Lo que devuelve NO se aplica solo: es una
 * propuesta que se revisa en pantalla antes de tocar ningún precio.
 */

const SYSTEM_PROMPT = `Eres un asistente que LEE listas de precios de proveedores de muebles.
Recibes el PDF de una lista y devuelves SOLO un arreglo JSON.

Cada elemento: {"nombre": "...", "precio": 0}
- "nombre": el nombre del producto TAL COMO viene en la lista, completo, incluyendo el tipo de mueble si lo trae (ej: "SALA 3-2-1 PARIS", "MESA MILAN 2.40", "RECAMARA DUBAI", "CABECERA VENECIA").
- "precio": el precio de venta al público, como número, sin signos ni comas (ej: 33985.00).

Reglas estrictas:
- Copia los nombres y los números EXACTAMENTE como aparecen. Está PROHIBIDO inventar, redondear o completar productos que no estén en el documento.
- Si una fila tiene varios precios (por tamaño o por versión), genera un elemento por cada uno y agrega el tamaño al nombre (ej: "MADRID QUEEN SIZE").
- Ignora encabezados, totales, notas de vigencia, teléfonos y datos del proveedor.
- Si el precio de una fila no se lee con claridad, omite esa fila. Es mejor omitirla que adivinar.
- Responde solo el arreglo JSON, sin explicaciones ni markdown.`;

const extraerSchema = z.object({
  fileName: z.string().min(1),
  base64: z.string().min(1),
  mimeType: z.string().optional(),
});

export type FilaExtraida = { nombre: string; precio: number };

function parsearFilas(texto: string): FilaExtraida[] {
  const limpio = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const inicio = limpio.indexOf("[");
  const fin = limpio.lastIndexOf("]");
  if (inicio === -1 || fin === -1) return [];

  try {
    const crudo = JSON.parse(limpio.slice(inicio, fin + 1)) as unknown;
    if (!Array.isArray(crudo)) return [];

    const filas: FilaExtraida[] = [];
    for (const item of crudo) {
      if (!item || typeof item !== "object") continue;
      const registro = item as Record<string, unknown>;
      const nombre = String(registro["nombre"] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      const precio = Number(
        typeof registro["precio"] === "string"
          ? registro["precio"].replace(/[^0-9.]/g, "")
          : registro["precio"],
      );
      // Un precio de mueble fuera de este rango casi siempre es un error de
      // lectura (un teléfono, un código, un año).
      if (!nombre || !Number.isFinite(precio) || precio < 100 || precio > 1_000_000) continue;
      filas.push({ nombre, precio });
    }
    return filas;
  } catch {
    return [];
  }
}

export const extraerListaDePrecios = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => extraerSchema.parse(data))
  .handler(async ({ data }) => {
    const texto = await createOpenAITextResponse([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Extrae los productos y precios de esta lista." },
          {
            type: "file",
            file: {
              filename: data.fileName,
              file_data: `data:${data.mimeType || "application/pdf"};base64,${data.base64}`,
            },
          },
        ],
      },
    ]);

    const filas = parsearFilas(texto);

    if (filas.length === 0) {
      throw new Error(
        "No se pudo leer ningún precio de este archivo. Revisa que sea una lista de precios legible.",
      );
    }

    return { archivo: data.fileName, filas };
  });
