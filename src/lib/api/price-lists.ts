import { supabase } from "@/lib/supabase-client";
import type { MuebleParaCruce } from "@/lib/domain/price-match";

/**
 * Aplicación de precios desde listas de proveedor.
 * Cliente-side: `muebles` tiene RLS admin-only, así que necesita la sesión.
 */

export async function getMueblesParaPrecios() {
  const { data, error } = await supabase
    .from("muebles")
    .select("id, nombre, categoria, precio")
    .order("nombre");

  if (error) throw new Error(error.message);
  return (data ?? []) as MuebleParaCruce[];
}

export type PrecioAplicable = {
  muebleId: string;
  precio: number;
  filaDeLista: string;
  archivo: string;
};

/**
 * Guarda el precio y deja constancia de DÓNDE salió, para que dentro de seis
 * meses se pueda saber por qué un mueble cuesta lo que cuesta.
 */
export async function aplicarPrecios(items: PrecioAplicable[]) {
  let aplicados = 0;
  const errores: string[] = [];

  for (const item of items) {
    const { data: actual, error: readError } = await supabase
      .from("muebles")
      .select("detalles")
      .eq("id", item.muebleId)
      .single();

    if (readError) {
      errores.push(readError.message);
      continue;
    }

    const detalles = (actual?.detalles ?? {}) as Record<string, unknown>;

    const { error } = await supabase
      .from("muebles")
      .update({
        precio: item.precio,
        detalles: {
          ...detalles,
          precio_origen: {
            archivo: item.archivo,
            fila: item.filaDeLista,
            aplicado_at: new Date().toISOString(),
          },
        },
      })
      .eq("id", item.muebleId);

    if (error) errores.push(error.message);
    else aplicados++;
  }

  return { aplicados, errores };
}
