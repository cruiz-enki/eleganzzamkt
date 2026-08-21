import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export const getDashboardStats = createServerFn({ method: "GET" })
  .handler(async () => {
    // 1. Muebles por categoría
    const { data: muebles, error: mError } = await supabase
      .from('muebles')
      .select('categoria');
    
    if (mError) throw new Error(mError.message);

    const categoriesCount: Record<string, number> = {};
    muebles?.forEach(m => {
      let cat = m.categoria || 'Sin Categoría';
      // Normalización para el conteo en dashboard
      const normalized = cat.trim().toLowerCase();
      if (normalized === "sala" || normalized === "salas") cat = "Salas";
      else if (normalized === "comedor" || normalized === "comedores") cat = "Comedores";
      else if (normalized === "cubrecama" || normalized === "set de cubrecama") cat = "Cubrecamas";
      else cat = cat.trim().charAt(0).toUpperCase() + cat.trim().slice(1);
      
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
