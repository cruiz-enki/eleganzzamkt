/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { createOpenAITextResponse } from "@/lib/api/openai";
import { z } from "zod";

/**
 * Extrae marca / medidas / materiales / colores desde la DESCRIPCIÓN del
 * producto, con IA. No escribe nada por su cuenta: primero devuelve una
 * propuesta para que la persona la revise, y solo guarda lo que se apruebe.
 */

export const SPEC_FIELDS = ["marca", "medidas", "materiales", "colores"] as const;
export type SpecField = (typeof SPEC_FIELDS)[number];

const SYSTEM_PROMPT = `Eres un asistente que EXTRAE datos de fichas de muebles y decoración de Eleganzza Muebles.
Recibes el nombre, la categoría y la descripción de un producto.
Devuelves SOLO un objeto JSON con estas cuatro llaves: "marca", "medidas", "materiales", "colores".

Reglas estrictas:
- Extrae ÚNICAMENTE lo que esté explícito en el texto. Está PROHIBIDO inventar, deducir o completar.
- Si un dato no aparece, esa llave vale null. Devolver null es correcto y esperado: es MUCHO mejor null que un dato dudoso.
- PROHIBIDO devolver frases publicitarias o vagas. Si el texto solo dice cosas como "alta calidad", "tonos neutros", "diseño moderno", "materiales premium", "acabado elegante", devuelve null en ese campo. Solo sirven datos concretos y verificables.
- "medidas": dimensiones con unidades, tal como vienen (ej: "Diámetro 25 cm", "2.40m x 2.50m", "φ800+500 H1200"). Si hay varias variantes (matrimonial, king), inclúyelas todas separadas por coma.
- "materiales": de qué está hecho, con nombre concreto (ej: "Metal, Vidrio", "Microfibra", "Tejido Glasgow"). "Tapizado de alta calidad" NO es un material: eso es null.
- "colores": color o acabado concreto (ej: "Oro", "Cromo", "Charcoal"). "Tonos neutros" o "colores cálidos" NO son colores: eso es null. Si el color aparece en el NOMBRE del producto (ej: "Eder Marino", "Hotelier Blanco"), sí cuenta.
- "marca": marca o proveedor solo si el texto lo nombra como tal. Un código de modelo (DMC352-1, SK106PL, Arb-DMW262) NO es marca: devuelve null.
- No incluyas potencia en watts en ningún campo.
- Responde solo el JSON, sin explicaciones ni markdown.`;

/** Frases que la IA a veces devuelve y que no son un dato real. */
const VALORES_VACIOS = new Set([
  "null",
  "n/a",
  "na",
  "no especificado",
  "no especificada",
  "no aplica",
  "sin dato",
  "sin datos",
  "desconocido",
  "-",
  "—",
]);

function limpiarValor(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value || VALORES_VACIOS.has(value.toLowerCase())) return null;
  // Un valor larguísimo casi siempre es la descripción entera, no un dato.
  if (value.length > 300) return null;
  return value;
}

function parseRespuesta(texto: string): Record<SpecField, string | null> {
  const vacio = { marca: null, medidas: null, materiales: null, colores: null } as Record<
    SpecField,
    string | null
  >;

  // El modelo a veces envuelve el JSON en ```json ... ```
  const limpio = texto
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const inicio = limpio.indexOf("{");
  const fin = limpio.lastIndexOf("}");
  if (inicio === -1 || fin === -1) return vacio;

  try {
    const json = JSON.parse(limpio.slice(inicio, fin + 1)) as Record<string, unknown>;
    return {
      marca: limpiarValor(json["marca"]),
      medidas: limpiarValor(json["medidas"]),
      materiales: limpiarValor(json["materiales"]),
      colores: limpiarValor(json["colores"]),
    };
  } catch {
    return vacio;
  }
}

export type SpecsCandidate = {
  id: string;
  nombre: string;
  categoria: string | null;
  descripcion: string;
  actuales: Record<SpecField, string | null>;
  faltantes: SpecField[];
};

/**
 * Muebles que tienen descripción y al menos un campo descriptivo vacío.
 * Toma en cuenta lo que ya vive en `detalles` (catálogo viejo) para no
 * proponer algo que en realidad ya se conoce.
 */
export const getSpecsExtractionCandidates = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabase
    .from("muebles")
    .select("id, nombre, categoria, descripcion, marca, medidas, materiales, colores, detalles")
    .order("nombre");

  if (error) throw new Error(error.message);

  const candidates: SpecsCandidate[] = [];
  let sinDescripcion = 0;
  let yaCompletos = 0;

  for (const row of data ?? []) {
    const descripcion = (row.descripcion ?? "").trim();
    if (!descripcion) {
      sinDescripcion++;
      continue;
    }

    const detalles = (row.detalles ?? {}) as any;
    const actuales = {
      marca: (row.marca ?? detalles.marca ?? null) || null,
      medidas: (row.medidas ?? detalles.medidas ?? null) || null,
      materiales: (row.materiales ?? detalles.materiales ?? null) || null,
      colores: (row.colores ?? detalles.colores ?? null) || null,
    } as Record<SpecField, string | null>;

    const faltantes = SPEC_FIELDS.filter((f) => !actuales[f]);
    if (faltantes.length === 0) {
      yaCompletos++;
      continue;
    }

    candidates.push({
      id: row.id,
      nombre: row.nombre,
      categoria: row.categoria ?? null,
      descripcion,
      actuales,
      faltantes,
    });
  }

  return { total: (data ?? []).length, sinDescripcion, yaCompletos, candidates };
});

const extractSchema = z.object({
  id: z.string(),
  nombre: z.string().min(1),
  categoria: z.string().nullable().optional(),
  descripcion: z.string().min(1),
});

/**
 * Propone los datos de UN producto. NO guarda: solo devuelve lo que encontró.
 */
export const extractMuebleSpecs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => extractSchema.parse(data))
  .handler(async ({ data }) => {
    const texto = await createOpenAITextResponse([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Nombre: ${data.nombre}\nCategoría: ${data.categoria ?? "sin categoría"}\nDescripción: ${data.descripcion}`,
      },
    ]);

    const propuesta = parseRespuesta(texto);
    const encontrados = SPEC_FIELDS.filter((f) => propuesta[f]);

    return { id: data.id, nombre: data.nombre, propuesta, encontrados };
  });

const applySchema = z.object({
  id: z.string(),
  marca: z.string().nullable().optional(),
  medidas: z.string().nullable().optional(),
  materiales: z.string().nullable().optional(),
  colores: z.string().nullable().optional(),
});

/**
 * Guarda los campos aprobados. Solo escribe los que vengan con valor y que
 * estén vacíos en la base: nunca pisa un dato capturado a mano.
 */
export const applyMuebleSpecs = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => applySchema.parse(data))
  .handler(async ({ data }) => {
    const { data: actual, error: readError } = await supabase
      .from("muebles")
      .select("marca, medidas, materiales, colores, detalles")
      .eq("id", data.id)
      .single();

    if (readError) throw new Error(readError.message);

    const detalles = (actual?.detalles ?? {}) as any;
    const cambios: Record<string, string> = {};

    for (const field of SPEC_FIELDS) {
      const propuesto = limpiarValor(data[field]);
      if (!propuesto) continue;
      const yaTiene = (actual as any)?.[field] || detalles[field];
      if (yaTiene) continue; // respetamos lo que ya estaba
      cambios[field] = propuesto;
    }

    if (Object.keys(cambios).length === 0) {
      return { id: data.id, guardados: [] as string[] };
    }

    const { error } = await supabase
      .from("muebles")
      .update({
        ...cambios,
        detalles: { ...detalles, specs_extracted_at: new Date().toISOString() },
      })
      .eq("id", data.id);

    if (error) throw new Error(error.message);

    return { id: data.id, guardados: Object.keys(cambios) };
  });
