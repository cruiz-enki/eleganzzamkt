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
    customSystem: z.string().optional(),
    customPrompt: z.string().optional(),
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

    // 2. Construir prompt según tipo, usando configuración guardada si existe (esto se manejaría mejor pasando los prompts como input)
    // Pero como estamos en un entorno serverless, leemos el prompt configurado que el cliente debería enviar o usamos defaults.
    // Para simplificar y que funcione con lo que el usuario configuró en el cliente, 
    // asumimos que el cliente enviará los prompts personalizados en el futuro, o los recuperamos si estuvieran en BD.
    
    // Por ahora, usaremos los defaults pero con la estructura flexible.
    const DEFAULT_PROMPTS = {
      copy: {
        system: "Eres un experto en marketing para una marca de muebles de lujo llamada Eleganzza Muebles. Crea textos persuasivos para redes sociales.",
        user: "Crea 3 opciones de copys (Instagram, Facebook y WhatsApp) para el producto: {nombre}. Categoría: {categoria}. Resalta la elegancia y confort."
      },
      story: {
        system: "Eres un director creativo de marketing para Eleganzza Muebles. Diseña una estructura de stories visualmente impactante.",
        user: "Diseña una secuencia de 3 historias para el producto: {nombre}. Describe los elementos visuales, el texto en pantalla y el llamado a la acción."
      },
      post: {
        system: "Eres un director creativo de marketing para Eleganzza Muebles. Diseña un post de feed estratégico.",
        user: "Describe detalladamente la composición visual, los colores y el copy principal para un post cuadrado de Instagram del producto: {nombre}."
      },
      carousel: {
        system: "Eres un director creativo de marketing para Eleganzza Muebles. Diseña un carrusel educativo o de venta.",
        user: "Crea una estructura de 5 diapositivas para un carrusel sobre el producto: {nombre}. Indica qué va en cada slide (título, cuerpo, imagen sugerida)."
      },
      prompt: {
        system: "Eres un experto en ingeniería de prompts para IA generativa de imágenes (Midjourney/DALL-E).",
        user: "Genera un prompt técnico y detallado para crear una escena de estilo de vida de lujo (Luxury Lifestyle) donde el mueble {nombre} sea el protagonista. Incluye iluminación, materiales y ambiente."
      }
    };

    const config = DEFAULT_PROMPTS[data.type];
    let systemMsg = data.customSystem || config.system;
    let userPrompt = (data.customPrompt || config.user)
      .replace(/{nombre}/g, mueble.nombre)
      .replace(/{categoria}/g, mueble.categoria || "Muebles");

    if (data.context) userPrompt += `\nContexto adicional: ${data.context}`;

    const body = {
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemMsg },
        { role: "user", content: userPrompt }
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

    // 3. Vincular con el producto
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

export const updateAIContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    muebleId: z.string(),
    index: z.number(),
    content: z.string()
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('detalles')
      .eq('id', data.muebleId)
      .single();
      
    if (error || !mueble) throw new Error("Producto no encontrado.");

    const detalles = mueble.detalles || {};
    const aiContent = [...(detalles.ai_content || [])];
    
    if (aiContent[data.index]) {
      aiContent[data.index].content = data.content;
      aiContent[data.index].updated_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('muebles')
      .update({ detalles: { ...detalles, ai_content: aiContent } })
      .eq('id', data.muebleId);

    if (updateError) throw updateError;
    return true;
  });

export const deleteAIContent = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({
    muebleId: z.string(),
    index: z.number()
  }).parse(data))
  .handler(async ({ data }) => {
    const { data: mueble, error } = await supabase
      .from('muebles')
      .select('detalles')
      .eq('id', data.muebleId)
      .single();
      
    if (error || !mueble) throw new Error("Producto no encontrado.");

    const detalles = mueble.detalles || {};
    let aiContent = [...(detalles.ai_content || [])];
    
    aiContent.splice(data.index, 1);

    const { error: updateError } = await supabase
      .from('muebles')
      .update({ detalles: { ...detalles, ai_content: aiContent } })
      .eq('id', data.muebleId);

    if (updateError) throw updateError;
    return true;
  });
