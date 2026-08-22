import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Bell, CheckCheck, ClipboardCheck, MessageSquareText, Zap } from "lucide-react";
import {
  getNotificaciones,
  marcarLeida,
  marcarTodasLeidas,
  type Notificacion,
  type TipoNotificacion,
} from "@/lib/api/notificaciones";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ICONO: Record<TipoNotificacion, typeof Bell> = {
  decision_cliente: ClipboardCheck,
  marca_catalogo: MessageSquareText,
  falla_tecnica: AlertTriangle,
  proceso: Zap,
};

const COLOR: Record<TipoNotificacion, string> = {
  decision_cliente: "text-[#00B5C8]",
  marca_catalogo: "text-[#9B1060]",
  falla_tecnica: "text-amber-500",
  proceso: "text-slate-400",
};

function haceCuanto(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutos < 1) return "ahora";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

export function NotificacionesBell({ onIr }: { onIr?: (seccion: string) => void }) {
  const queryClient = useQueryClient();

  const { data: notificaciones = [] } = useQuery({
    queryKey: ["notificaciones"],
    queryFn: () => getNotificaciones(30),
    // Sin realtime por ahora: revisar cada minuto es suficiente y no abre
    // una conexión permanente por cada pestaña.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const sinLeer = notificaciones.filter((n) => !n.leida_at).length;
  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["notificaciones"] });

  const abrir = async (n: Notificacion) => {
    if (!n.leida_at) {
      await marcarLeida(n.id);
      await refrescar();
    }
    if (n.seccion && onIr) onIr(n.seccion);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative h-9 w-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label={sinLeer > 0 ? `${sinLeer} notificaciones sin leer` : "Notificaciones"}
        >
          <Bell className="h-5 w-5" />
          {sinLeer > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#9B1060] text-white text-[10px] font-bold flex items-center justify-center">
              {sinLeer > 9 ? "9+" : sinLeer}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Notificaciones
          </span>
          {sinLeer > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-slate-500"
              onClick={async () => {
                await marcarTodasLeidas();
                await refrescar();
              }}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              Marcar todas
            </Button>
          )}
        </div>

        <ScrollArea className="max-h-[380px]">
          {notificaciones.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10 px-4">
              Aquí van a aparecer las decisiones del cliente, sus marcas en el catálogo, las fallas
              técnicas y los procesos que terminen.
            </p>
          ) : (
            <div className="divide-y divide-slate-50 dark:divide-slate-800">
              {notificaciones.map((n) => {
                const Icono = ICONO[n.tipo] ?? Bell;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => abrir(n)}
                    className={cn(
                      "w-full text-left px-3 py-2.5 flex gap-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors",
                      !n.leida_at && "bg-[#00B5C8]/5",
                    )}
                  >
                    <Icono className={cn("h-4 w-4 shrink-0 mt-0.5", COLOR[n.tipo])} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block text-xs text-slate-700 dark:text-slate-200",
                          !n.leida_at && "font-semibold",
                        )}
                      >
                        {n.titulo}
                      </span>
                      {n.mensaje && (
                        <span className="block text-[11px] text-slate-500 line-clamp-2">
                          {n.mensaje}
                        </span>
                      )}
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {haceCuanto(n.created_at)}
                      </span>
                    </span>
                    {!n.leida_at && (
                      <span className="h-2 w-2 rounded-full bg-[#00B5C8] shrink-0 mt-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
