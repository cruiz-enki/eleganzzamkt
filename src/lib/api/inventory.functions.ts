import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";

export type Mueble = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number | null;
  fotos: any[] | null;
  descripcion: string | null;
  detalles: any | null;
  created_at: string;
};

export const getSupabaseInventory = createServerFn({ method: "GET" })
  .handler(async () => {
    const { data, error } = await supabase
      .from('muebles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching Supabase inventory:", error);
      throw new Error(error.message);
    }

    return data as Mueble[];
  });

export const upsertMueble = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: Partial<Mueble> }) => {
    const { id, ...updateData } = data;
    
    if (id) {
      const { data: result, error } = await supabase
        .from('muebles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);
      return result as Mueble;
    } else {
      const { data: result, error } = await supabase
        .from('muebles')
        .insert([updateData])
        .select()
        .single();

      if (error) throw new Error(error.message);
      return result as Mueble;
    }
  });

export const deleteMueble = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { id: string } }) => {
    const { error } = await supabase
      .from('muebles')
      .delete()
      .eq('id', data.id);

    if (error) throw new Error(error.message);
    return { success: true };
  });
