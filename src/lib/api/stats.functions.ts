import { createServerFn } from "@tanstack/react-start";
import { supabase } from "@/lib/supabase-client";

export const getDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    // 1. Muebles por categoría
    const { data: muebles, error: mError } = await supabase
      .from('muebles')
      .select('categoria');
    
    if (mError) throw new Error(mError.message);

    const categoriesCount: Record<string, number> = {};
    muebles?.forEach(m => {
      const cat = m.categoria || 'Sin Categoría';
      categoriesCount[cat] = (categoriesCount[cat] || 0) + 1;
    });

    // 2. Campaña activa
    // Buscamos la primera campaña que esté en rango de fechas
    const now = new Date().toISOString();
    const { data: campaigns, error: cError } = await supabase
      .from('campanas')
      .select('*')
      .lte('fecha_inicio', now)
      .gte('fecha_fin', now)
      .limit(1);
    
    const activeCampaign = campaigns && campaigns.length > 0 ? campaigns[0] : null;

    // 3. Catálogos cargados
    const { count: catalogosCount, error: catError } = await supabase
      .from('catalogos')
      .select('*', { count: 'exact', head: true });

    return {
      categoriesCount,
      activeCampaign,
      catalogosCount: catalogosCount || 0,
      totalMuebles: muebles?.length || 0
    };
  });
