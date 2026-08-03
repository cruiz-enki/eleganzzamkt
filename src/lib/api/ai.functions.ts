import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

const OPENAI_GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";

function aiHeaders() {
  const lovableApiKey = process.env['LOVABLE_API_KEY'];

  if (!lovableApiKey) {
    throw new Error("Falta LOVABLE_API_KEY en los secretos.");
  }

  return {
    'Lovable-API-Key': lovableApiKey,
    'Content-Type': 'application/json',
  };
}

const AI_MODEL = "google/gemini-3.6-flash";

const chatSchema = z.object({
  prompt: z.string().min(1),
  systemMessage: z.string().optional(),
});

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data }) => {
    const headers = aiHeaders();

    const body = {
      model: AI_MODEL,
      messages: [
        {
          role: "system",
          content: data.systemMessage || "Eres un experto en marketing para una marca de muebles de lujo llamada Eleganzza Muebles. Crea copys atractivos y profesionales."
        },
        {
          role: "user",
          content: data.prompt
        }
      ],
      temperature: 0.7,
    };

    const res = await fetch(OPENAI_GATEWAY, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`OpenAI Gateway error [${res.status}]: ${errorText}`);
      throw new Error(`Error de AI: ${errorText}`);
    }

    const result = await res.json();
    return result.choices[0]?.message?.content || "No se pudo generar una respuesta.";
  });

const cleanupSchema = z.object({
  imageUrl: z.string().url(),
});

export const cleanProductImage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => cleanupSchema.parse(data))
  .handler(async ({ data }) => {
    const headers = aiHeaders();

    // Utilizamos DALL-E 3 o GPT-4o con capacidades de edición si estuvieran disponibles, 
    // pero para "limpiar" una imagen existente (in-painting/edit), el API de OpenAI 
    // requiere multipart/form-data. Por ahora, simulamos la intención con GPT-4o-vision 
    // para describir los cambios o usamos el endpoint de edits si es soportado por el gateway.
    
    // Nota: El gateway de Lovable expone principalmente chat/completions.
    // Para una implementación real de edición de imagen ("clean"), se requeriría 
    // el endpoint v1/images/edits o herramientas específicas de remoción de fondo.
    
    const body = {
      model: AI_MODEL,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Analiza esta imagen de un mueble. Mi objetivo es tener una imagen limpia para catálogo: sin fondos distractores, sin textos y sin marcas de agua. Describe detalladamente cómo debería verse la versión final procesada." },
            { type: "image_url", image_url: { url: data.imageUrl } }
          ]
        }
      ]
    };

    const res = await fetch(OPENAI_GATEWAY, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error al analizar imagen: ${errorText}`);
    }

    const result = await res.json();
    return result.choices[0]?.message?.content || "Procesamiento de imagen iniciado.";
  });

export const generateProductCreative = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    muebleId: z.string(),
    type: z.enum(["story", "carousel", "post", "copy", "prompt"]),
    context: z.string().optional(),
  }).parse(data))
  .handler(async ({ data }) => {
    const headers = aiHeaders();
    
    // 1. Obtener info del producto de Supabase
    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('*')
      .eq('id', data.muebleId)
      .single();
      
    if (error || !mueble) throw new Error("No se encontró el producto.");

    // 2. Construir prompt según tipo
    let systemMsg = "Eres un director creativo de marketing para Eleganzza Muebles. ";
    let prompt = `Genera contenido para el producto: ${mueble.nombre}. Categoría: ${mueble.categoria}. `;
    
    if (data.type === "copy") {
      systemMsg += "Crea textos persuasivos para redes sociales.";
      prompt += "Crea 3 opciones de copys (Instagram, Facebook y WhatsApp) que resalten la elegancia y confort.";
    } else if (data.type === "prompt") {
      systemMsg += "Crea prompts técnicos para generadores de imágenes (Midjourney/DALL-E).";
      prompt += "Genera un prompt detallado para crear una escena de estilo de vida de lujo donde este mueble sea el protagonista.";
    } else {
      systemMsg += `Diseña una estructura de ${data.type} visualmente impactante.`;
      prompt += `Describe detalladamente los elementos visuales, colores y composición para un ${data.type} de este producto.`;
    }

    if (data.context) prompt += `\nContexto adicional: ${data.context}`;

    const body = {
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: prompt }
      ],
    };

    const res = await fetch(OPENAI_GATEWAY, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`AI Gateway error [${res.status}]: ${errorText}`);
      if (res.status === 429) throw new Error("Límite de solicitudes alcanzado. Intenta de nuevo en un momento.");
      if (res.status === 402) throw new Error("Créditos de IA agotados. Agrega créditos en Settings → Workspace → Usage.");
      throw new Error(`Error de IA: ${errorText}`);
    }

    const result = await res.json();
    const content = result.choices[0]?.message?.content;

    // 3. Vincular con el producto guardando en una tabla de 'contenido_ia' o similar
    // Si no existe la tabla, podemos guardarlo en el campo 'detalles' del mueble por ahora
    const { data: updatedMueble } = await supabase
      .from('muebles')
      .select('detalles')
      .eq('id', data.muebleId)
      .single();

    const detalles = updatedMueble?.detalles || {};
    const aiContent = detalles.ai_content || [];
    aiContent.push({
      type: data.type,
      content,
      created_at: new Date().toISOString()
    });

    await supabase
      .from('muebles')
      .update({ detalles: { ...detalles, ai_content: aiContent } })
      .eq('id', data.muebleId);

    return content;
  });
