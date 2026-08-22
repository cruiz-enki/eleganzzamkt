import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getSpecsExtractionCandidates,
  extractMuebleSpecs,
  applyMuebleSpecs,
  SPEC_FIELDS,
  type SpecsCandidate,
  type SpecField,
} from "@/lib/api/specs-extraction.functions";
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
import { Sparkles, Loader2, CheckCircle2, AlertCircle, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ETIQUETA: Record<SpecField, string> = {
  marca: "Marca",
  medidas: "Medidas",
  materiales: "Materiales",
  colores: "Colores",
};

type Propuesta = {
  id: string;
  nombre: string;
  propuesta: Record<SpecField, string | null>;
  encontrados: SpecField[];
};

type Fase = "seleccion" | "extrayendo" | "revision" | "guardando" | "listo";

type SpecsExtractorProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function SpecsExtractor({
  open: openProp,
  onOpenChange,
  hideTrigger,
}: SpecsExtractorProps = {}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };
  const [fase, setFase] = useState<Fase>("seleccion");
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());
  const [propuestas, setPropuestas] = useState<Propuesta[]>([]);
  const [aprobados, setAprobados] = useState<Set<string>>(new Set());
  const [progreso, setProgreso] = useState({ current: 0, total: 0 });
  const [errores, setErrores] = useState<string[]>([]);
  const [guardadas, setGuardadas] = useState(0);
  const [incluirProcesados, setIncluirProcesados] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["specs-extraction-candidates", incluirProcesados],
    queryFn: () => getSpecsExtractionCandidates({ data: { incluirProcesados } }),
    enabled: isOpen,
    staleTime: 0,
  });

  const candidatos = useMemo(() => data?.candidates ?? [], [data]);

  useEffect(() => {
    if (candidatos.length > 0 && fase === "seleccion") {
      setSeleccionados(new Set(candidatos.map((c) => c.id)));
    }
  }, [candidatos, fase]);

  const reset = () => {
    setFase("seleccion");
    setSeleccionados(new Set());
    setPropuestas([]);
    setAprobados(new Set());
    setProgreso({ current: 0, total: 0 });
    setErrores([]);
    setGuardadas(0);
  };

  const handleOpenChange = (next: boolean) => {
    if (fase === "extrayendo" || fase === "guardando") return;
    setOpen(next);
    if (!next) reset();
  };

  const toggle = (set: Set<string>, apply: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };

  const handleExtraer = async () => {
    const lote = candidatos.filter((c) => seleccionados.has(c.id));
    if (lote.length === 0) return;

    setFase("extrayendo");
    setProgreso({ current: 0, total: lote.length });
    setErrores([]);

    const encontradas: Propuesta[] = [];
    for (let i = 0; i < lote.length; i++) {
      const c = lote[i] as SpecsCandidate;
      try {
        const res = await extractMuebleSpecs({
          data: {
            id: c.id,
            nombre: c.nombre,
            categoria: c.categoria,
            descripcion: c.descripcion,
          },
        });
        // Solo proponemos los campos que hoy están vacíos.
        const propuesta = { ...res.propuesta };
        for (const f of SPEC_FIELDS) if (c.actuales[f]) propuesta[f] = null;
        const utiles = SPEC_FIELDS.filter((f) => propuesta[f]);
        if (utiles.length > 0) {
          encontradas.push({ id: c.id, nombre: c.nombre, propuesta, encontrados: utiles });
        }
      } catch (err) {
        setErrores((prev) => [
          ...prev,
          `${c.nombre}: ${err instanceof Error ? err.message : "error"}`,
        ]);
      }
      setProgreso({ current: i + 1, total: lote.length });
      setPropuestas([...encontradas]);
    }

    setAprobados(new Set(encontradas.map((p) => p.id)));
    setFase("revision");
  };

  const handleGuardar = async () => {
    const aGuardar = propuestas.filter((p) => aprobados.has(p.id));
    if (aGuardar.length === 0) return;

    setFase("guardando");
    setProgreso({ current: 0, total: aGuardar.length });
    let ok = 0;

    for (let i = 0; i < aGuardar.length; i++) {
      const p = aGuardar[i] as Propuesta;
      try {
        const res = await applyMuebleSpecs({ data: { id: p.id, ...p.propuesta } });
        if (res.guardados.length > 0) ok++;
      } catch (err) {
        setErrores((prev) => [
          ...prev,
          `${p.nombre}: ${err instanceof Error ? err.message : "error"}`,
        ]);
      }
      setProgreso({ current: i + 1, total: aGuardar.length });
    }

    setGuardadas(ok);
    setFase("listo");
    await queryClient.invalidateQueries({ queryKey: ["supabase-inventory"] });
    toast.success(`Se completaron las fichas de ${ok} productos`);
  };

  const pct = progreso.total > 0 ? Math.round((progreso.current / progreso.total) * 100) : 0;
  const camposPropuestos = propuestas
    .filter((p) => aprobados.has(p.id))
    .reduce((acc, p) => acc + p.encontrados.length, 0);

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          onClick={() => setOpen(true)}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Completar fichas con IA
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-3xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-slate-400" />
              Completar fichas con IA
            </DialogTitle>
            <DialogDescription>
              Lee la descripción de cada producto y saca de ahí marca, medidas, materiales y
              colores. Solo extrae lo que el texto ya dice; si no lo dice, lo deja vacío. Nada se
              guarda hasta que lo revises.
            </DialogDescription>
          </DialogHeader>

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
              <span className="text-sm">Buscando productos con ficha incompleta…</span>
            </div>
          )}

          {isError && !isLoading && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 p-4 rounded-lg flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-500 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300 break-words">
                {error instanceof Error ? error.message : "Error desconocido"}
              </p>
            </div>
          )}

          {/* Paso 1: elegir productos */}
          {fase === "seleccion" && !isLoading && !isError && (
            <>
              {candidatos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                  <CheckCircle2 className="h-10 w-10 text-emerald-400" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    No hay nada que completar
                  </p>
                  <p className="text-xs text-slate-500">
                    {data?.yaProcesados
                      ? `Ya se procesaron ${data.yaProcesados} productos con IA.`
                      : "Todas las fichas están completas."}
                    {data?.sinDescripcion
                      ? ` Otros ${data.sinDescripcion} no tienen descripción de dónde extraer.`
                      : ""}
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={seleccionados.size === candidatos.length}
                        onCheckedChange={() =>
                          setSeleccionados(
                            seleccionados.size === candidatos.length
                              ? new Set()
                              : new Set(candidatos.map((c) => c.id)),
                          )
                        }
                        id="select-all-specs"
                      />
                      <label
                        htmlFor="select-all-specs"
                        className="text-slate-600 dark:text-slate-300 cursor-pointer select-none"
                      >
                        {seleccionados.size} de {candidatos.length} seleccionados
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
                      {candidatos.map((c) => (
                        <label
                          key={c.id}
                          className="flex items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <Checkbox
                            className="mt-1"
                            checked={seleccionados.has(c.id)}
                            onCheckedChange={() => toggle(seleccionados, setSeleccionados, c.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {c.nombre}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">{c.descripcion}</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {c.faltantes.map((f) => (
                                <Badge
                                  key={f}
                                  variant="secondary"
                                  className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-0 font-normal text-[10px]"
                                >
                                  falta {ETIQUETA[f].toLowerCase()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </ScrollArea>

                  {(data?.yaProcesados ?? 0) > 0 && (
                    <label className="flex items-start gap-2 rounded-lg border border-slate-100 dark:border-slate-800 p-3 cursor-pointer">
                      <Checkbox
                        className="mt-0.5"
                        checked={incluirProcesados}
                        onCheckedChange={() => setIncluirProcesados((v) => !v)}
                      />
                      <span className="text-xs text-slate-600 dark:text-slate-300">
                        Volver a procesar los {data?.yaProcesados} productos que ya pasaron por la
                        IA.
                        <span className="block text-slate-400">
                          Normalmente no hace falta: si la descripción no cambió, la IA va a
                          responder lo mismo y solo se gastan llamadas.
                        </span>
                      </span>
                    </label>
                  )}

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-lg flex gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Es una consulta a la IA por producto, así que tarda unos segundos cada uno. No
                      cierres esta ventana mientras corre. Después vas a poder revisar producto por
                      producto antes de guardar.
                    </p>
                  </div>
                </>
              )}
            </>
          )}

          {/* Paso 2: corriendo */}
          {(fase === "extrayendo" || fase === "guardando") && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
                <span>{fase === "extrayendo" ? "Leyendo descripciones…" : "Guardando…"}</span>
                <span className="font-medium">
                  {progreso.current} / {progreso.total}
                </span>
              </div>
              <Progress value={pct} />
              {fase === "extrayendo" && (
                <p className="text-xs text-slate-400">
                  {propuestas.length} productos con datos encontrados hasta ahora
                </p>
              )}
            </div>
          )}

          {/* Paso 3: revisar */}
          {fase === "revision" && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-300">
                  {aprobados.size} de {propuestas.length} productos aprobados · {camposPropuestos}{" "}
                  campos por guardar
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-slate-500"
                  onClick={() =>
                    setAprobados(
                      aprobados.size === propuestas.length
                        ? new Set()
                        : new Set(propuestas.map((p) => p.id)),
                    )
                  }
                >
                  {aprobados.size === propuestas.length ? "Quitar todos" : "Aprobar todos"}
                </Button>
              </div>

              <ScrollArea className="h-80 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {propuestas.length === 0 && (
                    <p className="text-sm text-slate-500 px-3 py-6 text-center">
                      La IA no encontró datos concretos en ninguna descripción.
                    </p>
                  )}
                  {propuestas.map((p) => (
                    <label
                      key={p.id}
                      className="flex items-start gap-3 px-3 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                    >
                      <Checkbox
                        className="mt-1"
                        checked={aprobados.has(p.id)}
                        onCheckedChange={() => toggle(aprobados, setAprobados, p.id)}
                      />
                      <div className="flex-1 min-w-0 space-y-1">
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                          {p.nombre}
                        </p>
                        {p.encontrados.map((f) => (
                          <div key={f} className="flex gap-2 text-xs">
                            <span className="text-slate-400 w-20 shrink-0">{ETIQUETA[f]}</span>
                            <span className="text-slate-700 dark:text-slate-300 break-words">
                              {p.propuesta[f]}
                            </span>
                          </div>
                        ))}
                      </div>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Paso 4: terminado */}
          {fase === "listo" && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Se completaron {guardadas} fichas
              </p>
              {errores.length > 0 && (
                <p className="text-xs text-amber-600">{errores.length} productos con error</p>
              )}
            </div>
          )}

          {errores.length > 0 && fase === "revision" && (
            <p className="text-xs text-amber-600">
              {errores.length} productos no se pudieron leer y se omitieron.
            </p>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {fase === "listo" ? (
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
                  disabled={fase === "extrayendo" || fase === "guardando"}
                >
                  Cancelar
                </Button>
                {fase === "revision" ? (
                  <Button
                    className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                    onClick={handleGuardar}
                    disabled={aprobados.size === 0}
                  >
                    Guardar {camposPropuestos} campos
                  </Button>
                ) : (
                  <Button
                    className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                    onClick={handleExtraer}
                    disabled={fase !== "seleccion" || isLoading || seleccionados.size === 0}
                  >
                    {fase === "extrayendo" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Extrayendo…
                      </>
                    ) : (
                      `Extraer de ${seleccionados.size} productos`
                    )}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
