import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  Copy,
  ExternalLink,
  Loader2,
  Trash2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getBrandDiscoveryRespuestas,
  deleteBrandDiscoveryRespuesta,
} from "@/lib/api/brand-discovery";

const PUBLIC_PATH = "/brand-discovery";

export function BrandDiscoveryPanel() {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: respuestas, isLoading } = useQuery({
    queryKey: ["brand-discovery-respuestas"],
    queryFn: getBrandDiscoveryRespuestas,
  });

  const del = useMutation({
    mutationFn: deleteBrandDiscoveryRespuesta,
    onSuccess: async () => {
      toast.success("Respuesta eliminada.");
      await queryClient.invalidateQueries({ queryKey: ["brand-discovery-respuestas"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
  });

  const publicUrl =
    (typeof window !== "undefined" ? window.location.origin : "https://eleganzzamkt.enkidad.com") +
    PUBLIC_PATH;

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-white">
            <ClipboardList className="h-5 w-5 text-slate-400" />
            Brand Discovery
          </h2>
          <p className="text-sm text-slate-500">
            Respuestas recibidas del formulario público de descubrimiento de marca.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200"
            onClick={() => {
              navigator.clipboard.writeText(publicUrl).then(() => toast.success("Enlace copiado"));
            }}
          >
            <Copy className="mr-2 h-4 w-4" />
            Copiar enlace
          </Button>
          <Button size="sm" className="h-9 bg-black text-white hover:bg-black/90" asChild>
            <a href={PUBLIC_PATH} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Abrir formulario
            </a>
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
        Comparte este enlace con quien quieras que conteste:{" "}
        <span className="font-mono text-xs text-slate-500">{publicUrl}</span>. Cuando presionen
        <b> “Enviar a Eleganzza”</b>, su respuesta aparece aquí.
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : (respuestas?.length ?? 0) === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm text-slate-500">Aún no hay respuestas.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(respuestas ?? []).map((r) => {
            const isOpen = expanded.has(r.id);
            const entries = Object.entries(r.respuestas ?? {});
            return (
              <div
                key={r.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <button
                  onClick={() => toggle(r.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
                >
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                      {r.nombre || "Sin nombre"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {new Date(r.created_at).toLocaleString("es-MX")} · {entries.length} respuestas
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm("¿Eliminar esta respuesta?")) del.mutate(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-100 px-4 py-3 dark:border-slate-800">
                    <dl className="space-y-2">
                      {entries.map(([k, v]) => (
                        <div key={k}>
                          <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            {k}
                          </dt>
                          <dd className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">
                            {String(v)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    {r.texto ? (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-xs text-slate-400">
                          Ver texto plano (para copiar)
                        </summary>
                        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {r.texto}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
