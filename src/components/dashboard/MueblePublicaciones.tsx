import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Loader2, Megaphone } from "lucide-react";
import {
  getPublicacionesDeMueble,
  ESTADO_LABEL,
  type PublicacionEstado,
} from "@/lib/api/publicaciones";
import { getDisplayImageUrl } from "@/lib/image-url";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const ESTADO_ESTILO: Record<PublicacionEstado, string> = {
  borrador: "bg-slate-100 text-slate-600",
  en_revision: "bg-amber-100 text-amber-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  cambios_solicitados: "bg-orange-100 text-orange-800",
  rechazada: "bg-red-100 text-red-700",
  publicada: "bg-blue-100 text-blue-800",
};

/**
 * Publicaciones de redes ligadas a un mueble, dentro de su ficha.
 * Solo lectura: se editan desde la sección Publicaciones.
 */
export function MueblePublicaciones({ muebleId }: { muebleId: string }) {
  const { data: publicaciones = [], isLoading } = useQuery({
    queryKey: ["publicaciones-mueble", muebleId],
    queryFn: () => getPublicacionesDeMueble(muebleId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
      </div>
    );
  }

  if (publicaciones.length === 0) {
    return (
      <div className="bg-slate-50 rounded-2xl p-8 border border-slate-100 text-center">
        <Megaphone className="h-8 w-8 text-slate-300 mx-auto" />
        <p className="text-sm text-slate-600 mt-2">
          Este mueble todavía no tiene publicaciones.
        </p>
        <p className="text-xs text-slate-400 mt-1">
          Se crean en la sección Publicaciones, eligiendo este producto.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {publicaciones.map((p) => (
        <div
          key={p.id}
          className="flex gap-4 bg-slate-50 rounded-2xl p-4 border border-slate-100"
        >
          {p.archivos?.[0] ? (
            <img
              src={getDisplayImageUrl(p.archivos[0])}
              alt={p.titulo}
              className="h-24 w-24 rounded-xl object-cover border border-slate-200 shrink-0"
              loading="lazy"
            />
          ) : (
            <div className="h-24 w-24 rounded-xl bg-slate-100 border border-slate-200 shrink-0" />
          )}

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge className={cn("border-0 text-[10px]", ESTADO_ESTILO[p.estado])}>
                {ESTADO_LABEL[p.estado]}
              </Badge>
              {p.canal && (
                <Badge
                  variant="secondary"
                  className="bg-slate-100 text-slate-500 border-0 text-[10px]"
                >
                  {p.canal}
                </Badge>
              )}
              {p.fecha_programada && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <CalendarDays className="h-3 w-3" />
                  {p.fecha_programada}
                </span>
              )}
            </div>

            <p className="text-sm font-medium text-slate-700">{p.titulo}</p>

            {p.copy && <p className="text-xs text-slate-500 line-clamp-3">{p.copy}</p>}

            {p.aprobada_por && (p.estado === "aprobada" || p.estado === "publicada") && (
              <p className="text-[11px] text-emerald-700">Autorizó {p.aprobada_por}</p>
            )}

            {(p.archivos?.length ?? 0) > 1 && (
              <p className="text-[11px] text-slate-400">
                {p.archivos.length} archivos en esta publicación
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
