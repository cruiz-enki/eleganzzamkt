import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const OPENAI_GATEWAY = "https://ai-gateway.lovable.dev/v1/chat/completions";

function aiHeaders() {
  const lovableApiKey = process.env['LOVABLE_API_KEY'];
  const openaiApiKey = process.env['OPENAI_API_KEY'];
  
  if (!lovableApiKey || !openaiApiKey) {
    throw new Error("Faltan credenciales: asegúrate de haber configurado LOVABLE_API_KEY y OPENAI_API_KEY en los secretos.");
  }
  
  return {
    Authorization: `Bearer ${lovableApiKey}`,
    'X-Connection-Api-Key': openaiApiKey,
    'Content-Type': 'application/json',
  };
}

const chatSchema = z.object({
  prompt: z.string().min(1),
  systemMessage: z.string().optional(),
});

export const generateMarketingCopy = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => chatSchema.parse(data))
  .handler(async ({ data }) => {
    const headers = aiHeaders();

    const body = {
      model: "gpt-4o",
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
      model: "gpt-4o",
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
