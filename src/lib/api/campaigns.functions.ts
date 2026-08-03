import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";
import { z } from "zod";

export type Campaign = {
  id: string;
  nombre: string;
  descripcion: string | null;
  canva_link: string | null;
  artes_oficiales: any[] | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  detalles: any | null;
  created_at: string;
};

export const getCampaigns = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from('campanas')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "campanas" does not exist')) {
        return [] as Campaign[];
      }
      console.error("Error fetching campaigns:", error);
      throw new Error(error.message);
    }

    return data as Campaign[];
  });

const campaignSchema = z.object({
  id: z.string().optional(),
  nombre: z.string().min(1),
  descripcion: z.string().optional().nullable(),
  canva_link: z.string().optional().nullable(),
  artes_oficiales: z.array(z.any()).optional().nullable(),
  fecha_inicio: z.string().optional().nullable(),
  fecha_fin: z.string().optional().nullable(),
  detalles: z.any().optional().nullable(),
});

export const upsertCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => campaignSchema.parse(data))
  .handler(async ({ data }) => {
    const { id, ...updateData } = data;

    if (id) {
      const { data: result, error } = await supabase
        .from('campanas')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return result as Campaign;
    }

    const { data: result, error } = await supabase
      .from('campanas')
      .insert([updateData])
      .select()
      .single();

    if (error) throw new Error(error.message);
    return result as Campaign;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabase
      .from('campanas')
      .delete()
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
