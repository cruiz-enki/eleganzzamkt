import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAirtableImportCandidates,
  importAirtableMueble,
  type AirtableCandidate,
} from "@/lib/api/airtable-import.functions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Database, Loader2, CheckCircle2, AlertCircle, ImageIcon, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

type ImportResult = {
  nombre: string;
  status: "ok" | "error";
  uploaded?: number;
  failed?: number;
  message?: string;
};

type AirtableImporterProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function AirtableImporter({
  open: openProp,
  onOpenChange,
  hideTrigger,
}: AirtableImporterProps = {}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<ImportResult[]>([]);
  const [finished, setFinished] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["airtable-import-candidates"],
    queryFn: () => getAirtableImportCandidates(),
    enabled: isOpen,
    staleTime: 0,
  });

  const candidates = useMemo(() => data?.candidates ?? [], [data]);

  // Al cargar los candidatos, seleccionarlos todos por defecto.
  useEffect(() => {
    if (candidates.length > 0 && !isImporting && !finished) {
      setSelected(new Set(candidates.map((c) => c.airtableId)));
    }
  }, [candidates, isImporting, finished]);

  const resetState = () => {
    setSelected(new Set());
    setIsImporting(false);
    setProgress({ current: 0, total: 0 });
    setResults([]);
    setFinished(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (isImporting) return; // no cerrar a media importación
    setOpen(next);
    if (!next) resetState();
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = candidates.length > 0 && selected.size === candidates.length;
  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(candidates.map((c) => c.airtableId)));
  };

  const handleImport = async () => {
    const toImport = candidates.filter((c) => selected.has(c.airtableId));
    if (toImport.length === 0) return;

    setIsImporting(true);
    setFinished(false);
    setResults([]);
    setProgress({ current: 0, total: toImport.length });

    const collected: ImportResult[] = [];
    for (let i = 0; i < toImport.length; i++) {
      const candidate = toImport[i] as AirtableCandidate;
      try {
        const res = await importAirtableMueble({
          data: {
            airtableId: candidate.airtableId,
            nombre: candidate.nombre,
            categoria: candidate.categoria,
            precio: candidate.precio,
            precio_2: candidate.precio_2,
            precio_3: candidate.precio_3,
            descripcion: candidate.descripcion,
            imageUrls: candidate.imageUrls,
          },
        });
        collected.push({
          nombre: candidate.nombre,
          status: "ok",
          uploaded: res.uploaded,
          failed: res.failed,
        });
      } catch (err) {
        collected.push({
          nombre: candidate.nombre,
          status: "error",
          message: err instanceof Error ? err.message : "Error desconocido",
        });
      }
      setProgress({ current: i + 1, total: toImport.length });
      setResults([...collected]);
    }

    setIsImporting(false);
    setFinished(true);

    const okCount = collected.filter((r) => r.status === "ok").length;
    const errCount = collected.length - okCount;

    await queryClient.invalidateQueries({ queryKey: ["supabase-inventory"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });

    if (errCount === 0) toast.success(`Se importaron ${okCount} productos con éxito`);
    else toast.warning(`Importados ${okCount}, con ${errCount} errores`);
  };

  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          onClick={() => setOpen(true)}
        >
          <Database className="h-4 w-4 mr-2" />
          Importar de Airtable
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Database className="h-5 w-5 text-slate-400" />
              Importar productos desde Airtable
            </DialogTitle>
            <DialogDescription>
              Se comparan los muebles de tu tabla "Total" en Airtable contra los que ya tienes en
              Supabase. Solo se muestran los nuevos.
            </DialogDescription>
          </DialogHeader>

          {/* Cargando candidatos */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <span className="text-sm">Leyendo Airtable y comparando…</span>
            </div>
          )}

          {/* Error al leer */}
          {isError && !isLoading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">No se pudo leer Airtable.</p>
                <p className="text-xs mt-1 break-words">
                  {error instanceof Error ? error.message : "Error desconocido"}
                </p>
              </div>
            </div>
          )}

          {/* Sin novedades */}
          {!isLoading && !isError && candidates.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Todo al día</p>
              <p className="text-xs text-slate-500">
                No hay productos nuevos en Airtable para importar.
              </p>
            </div>
          )}

          {/* Lista de candidatos */}
          {!isLoading && !isError && candidates.length > 0 && !isImporting && !finished && (
            <>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    id="select-all-airtable"
                  />
                  <label
                    htmlFor="select-all-airtable"
                    className="text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                  >
                    {selected.size} de {candidates.length} seleccionados
                  </label>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500"
                  onClick={() => refetch()}
                  disabled={isFetching}
                >
                  <RefreshCcw className={cn("h-3 w-3 mr-1", isFetching && "animate-spin")} />
                  Recargar
                </Button>
              </div>

              <ScrollArea className="h-72 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {candidates.map((c) => {
                    const checked = selected.has(c.airtableId);
                    return (
                      <label
                        key={c.airtableId}
                        className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleOne(c.airtableId)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                            {c.nombre}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge
                              variant="secondary"
                              className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-0 font-normal text-[10px]"
                            >
                              {c.categoria ?? "Sin categoría"}
                            </Badge>
                            <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                              <ImageIcon className="h-3 w-3" />
                              {c.imageUrls.length}
                            </span>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0">
                          {c.precio ? currency.format(c.precio) : "—"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Por cada producto se creará una carpeta en Google Drive y se descargarán sus
                  imágenes de Airtable para guardarlas de forma permanente. Puede tardar unos
                  segundos por producto.
                </p>
              </div>
            </>
          )}

          {/* Progreso / resultados */}
          {(isImporting || finished) && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                  <span>{isImporting ? "Importando…" : "Importación terminada"}</span>
                  <span className="font-medium">
                    {progress.current} / {progress.total}
                  </span>
                </div>
                <Progress value={pct} />
              </div>

              <ScrollArea className="h-56 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {results.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm">
                      {r.status === "ok" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />
                      )}
                      <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-slate-200">
                        {r.nombre}
                      </span>
                      {r.status === "ok" ? (
                        <span className="text-[11px] text-slate-400 shrink-0">
                          {r.uploaded ?? 0} img
                          {r.failed ? ` · ${r.failed} fallaron` : ""}
                        </span>
                      ) : (
                        <span className="text-[11px] text-red-500 shrink-0 truncate max-w-[180px]">
                          {r.message}
                        </span>
                      )}
                    </div>
                  ))}
                  {isImporting && (
                    <div className="flex items-center gap-2 px-3 py-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      <span>Procesando…</span>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {finished ? (
              <Button
                className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                onClick={() => handleOpenChange(false)}
              >
                Cerrar
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => handleOpenChange(false)}
                  disabled={isImporting}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                  onClick={handleImport}
                  disabled={
                    isImporting || isLoading || candidates.length === 0 || selected.size === 0
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importando…
                    </>
                  ) : (
                    `Importar (${selected.size})`
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
