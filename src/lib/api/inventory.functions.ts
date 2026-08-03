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
