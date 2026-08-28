import { supabase } from "@/lib/supabase-client";

// Respuestas del formulario público de Brand Discovery. Cliente-side (admin):
// usa la sesión de Auth; RLS admin-only sobre brand_discovery_respuestas.

export type BrandDiscoveryRespuesta = {
  id: string;
  nombre: string | null;
  respuestas: Record<string, unknown>;
  texto: string | null;
  created_at: string;
};

export async function getBrandDiscoveryRespuestas() {
  const { data, error } = await supabase
    .from("brand_discovery_respuestas")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BrandDiscoveryRespuesta[];
}

export async function deleteBrandDiscoveryRespuesta(id: string) {
  const { error } = await supabase.from("brand_discovery_respuestas").delete().eq("id", id);
  if (error) throw new Error(error.message);
  return { success: true };
}
