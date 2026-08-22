import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, FileText, Loader2, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { extraerListaDePrecios } from "@/lib/api/price-lists.functions";
import { getMueblesParaPrecios, aplicarPrecios } from "@/lib/api/price-lists";
import { cruzarPrecios, type Cruce, type FilaDeLista } from "@/lib/domain/price-match";
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
import { cn } from "@/lib/utils";
import { notificarAlEquipo } from "@/lib/api/notificaciones";

const currency = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

function leerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("No se pudo leer el archivo"));
      const base64 = result.split(",")[1];
      if (!base64) return reject(new Error("Archivo inválido"));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

type PriceReconcilerProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export function PriceReconciler({
  open: openProp,
  onOpenChange,
  hideTrigger,
}: PriceReconcilerProps = {}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };

  const [archivo, setArchivo] = useState<string | null>(null);
  const [filas, setFilas] = useState<FilaDeLista[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [soloSinPrecio, setSoloSinPrecio] = useState(true);
  const [elegidos, setElegidos] = useState<Record<string, number>>({});
  const [aprobados, setAprobados] = useState<Set<string>>(new Set());
  const [resultado, setResultado] = useState<{ aplicados: number; errores: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: muebles = [] } = useQuery({
    queryKey: ["muebles-para-precios"],
    queryFn: getMueblesParaPrecios,
    enabled: isOpen,
  });

  const cruces: Cruce[] = useMemo(() => {
    if (filas.length === 0) return [];
    const universo = soloSinPrecio ? muebles.filter((m) => !m.precio) : muebles;
    const resultado = cruzarPrecios(universo, filas);
    // Los confiables primero: son los que se aprueban de un vistazo.
    return resultado.sort((a, b) => Number(b.confiable) - Number(a.confiable));
  }, [muebles, filas, soloSinPrecio]);

  const confiables = cruces.filter((c) => c.confiable).length;

  const reset = () => {
    setArchivo(null);
    setFilas([]);
    setElegidos({});
    setAprobados(new Set());
    setResultado(null);
    setLeyendo(false);
    setAplicando(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (leyendo || aplicando) return;
    setOpen(next);
    if (!next) reset();
  };

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLeyendo(true);
    setResultado(null);
    try {
      const base64 = await leerBase64(file);
      const res = await extraerListaDePrecios({
        data: { fileName: file.name, base64, mimeType: file.type || "application/pdf" },
      });
      setArchivo(res.archivo);
      setFilas(res.filas);
      setAprobados(new Set());
      setElegidos({});
      toast.success(`Se leyeron ${res.filas.length} precios de la lista`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer la lista");
    } finally {
      setLeyendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const candidatoDe = (cruce: Cruce) => {
    const indice = elegidos[cruce.mueble.id] ?? 0;
    return cruce.candidatos[indice] ?? cruce.candidatos[0];
  };

  const handleAplicar = async () => {
    const items = cruces
      .filter((c) => aprobados.has(c.mueble.id))
      .map((c) => {
        const candidato = candidatoDe(c);
        return {
          muebleId: c.mueble.id,
          precio: candidato?.precio ?? 0,
          filaDeLista: candidato?.nombre ?? "",
          archivo: archivo ?? "",
        };
      })
      .filter((i) => i.precio > 0);

    if (items.length === 0) return;

    setAplicando(true);
    try {
      const res = await aplicarPrecios(items);
      setResultado({ aplicados: res.aplicados, errores: res.errores.length });
      await notificarAlEquipo({
        tipo: "proceso",
        titulo: `Se aplicaron ${res.aplicados} precios`,
        mensaje: `Desde la lista ${archivo ?? ""}`.trim(),
        seccion: "productos",
      });
      await queryClient.invalidateQueries({ queryKey: ["supabase-inventory"] });
      await queryClient.invalidateQueries({ queryKey: ["muebles-para-precios"] });
      if (res.errores.length === 0) toast.success(`Se aplicaron ${res.aplicados} precios`);
      else toast.warning(`Aplicados ${res.aplicados}, con ${res.errores.length} errores`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron aplicar");
    } finally {
      setAplicando(false);
    }
  };

  return (
    <>
      {!hideTrigger && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
          onClick={() => setOpen(true)}
        >
          <FileText className="h-4 w-4 mr-2" />
          Cargar lista de precios
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-4xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white flex items-center gap-2">
              <FileText className="h-5 w-5 text-slate-400" />
              Cargar lista de precios
            </DialogTitle>
            <DialogDescription>
              Sube el PDF del proveedor. Se lee la lista, se busca a qué muebles corresponde y tú
              apruebas cada precio antes de que se guarde.
            </DialogDescription>
          </DialogHeader>

          {/* Paso 1: subir */}
          {filas.length === 0 && (
            <div className="py-8 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={leyendo}
                className="w-full max-w-sm rounded-xl border border-dashed border-slate-300 dark:border-slate-700 p-8 flex flex-col items-center gap-3 hover:border-slate-400 transition-colors"
              >
                {leyendo ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
                    <span className="text-sm text-slate-500">
                      Leyendo la lista… puede tardar un minuto
                    </span>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-slate-300" />
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      Elegir PDF de la lista
                    </span>
                    <span className="text-xs text-slate-400">
                      Funciona con listas de texto y con escaneadas
                    </span>
                  </>
                )}
              </button>
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                onChange={handleArchivo}
              />
            </div>
          )}

          {/* Paso 2: revisar */}
          {filas.length > 0 && !resultado && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <div className="text-slate-600 dark:text-slate-300">
                  <span className="font-medium">{filas.length}</span> precios leídos ·{" "}
                  <span className="font-medium">{cruces.length}</span> muebles con candidato ·{" "}
                  <span className="font-medium text-emerald-700">{confiables}</span> confiables
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                    <Checkbox
                      checked={soloSinPrecio}
                      onCheckedChange={() => setSoloSinPrecio((v) => !v)}
                    />
                    Solo los que no tienen precio
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500"
                    onClick={() =>
                      setAprobados(
                        new Set(cruces.filter((c) => c.confiable).map((c) => c.mueble.id)),
                      )
                    }
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Aprobar los confiables
                  </Button>
                </div>
              </div>

              <ScrollArea className="h-96 rounded-lg border border-slate-100 dark:border-slate-800">
                <div className="divide-y divide-slate-50 dark:divide-slate-800">
                  {cruces.length === 0 && (
                    <p className="text-sm text-slate-500 px-3 py-8 text-center">
                      Ningún mueble del catálogo coincide con esta lista.
                    </p>
                  )}
                  {cruces.map((cruce) => {
                    const candidato = candidatoDe(cruce);
                    const aprobado = aprobados.has(cruce.mueble.id);
                    return (
                      <div
                        key={cruce.mueble.id}
                        className={cn(
                          "flex items-start gap-3 px-3 py-2.5",
                          aprobado && "bg-emerald-50/50 dark:bg-emerald-900/10",
                        )}
                      >
                        <Checkbox
                          className="mt-1"
                          checked={aprobado}
                          onCheckedChange={() =>
                            setAprobados((prev) => {
                              const next = new Set(prev);
                              if (next.has(cruce.mueble.id)) next.delete(cruce.mueble.id);
                              else next.add(cruce.mueble.id);
                              return next;
                            })
                          }
                        />

                        <div className="flex-1 min-w-0 grid sm:grid-cols-2 gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">
                              {cruce.mueble.nombre}
                            </p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge
                                variant="secondary"
                                className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-0 text-[10px]"
                              >
                                {cruce.mueble.categoria ?? "Sin categoría"}
                              </Badge>
                              {cruce.mueble.precio ? (
                                <span className="text-[10px] text-slate-400">
                                  hoy {currency.format(cruce.mueble.precio)}
                                </span>
                              ) : null}
                              {cruce.confiable ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px]">
                                  confiable
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-0 text-[10px]">
                                  {cruce.candidatos.length} opciones
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="min-w-0">
                            {cruce.candidatos.length > 1 ? (
                              <select
                                value={elegidos[cruce.mueble.id] ?? 0}
                                onChange={(e) =>
                                  setElegidos({
                                    ...elegidos,
                                    [cruce.mueble.id]: Number(e.target.value),
                                  })
                                }
                                className="w-full h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-xs"
                              >
                                {cruce.candidatos.map((c, i) => (
                                  <option key={`${c.nombre}-${i}`} value={i}>
                                    {c.nombre} — {currency.format(c.precio)}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                                {candidato?.nombre}
                              </p>
                            )}
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5">
                              {candidato ? currency.format(candidato.precio) : "—"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-lg flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Revisa los que dicen "opciones": ahí el nombre del modelo coincide con varias
                  filas de la lista y solo tú sabes cuál es. Se guarda de qué archivo y de qué
                  renglón salió cada precio.
                </p>
              </div>
            </>
          )}

          {aplicando && <Progress value={undefined} />}

          {/* Paso 3: resultado */}
          {resultado && (
            <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Se aplicaron {resultado.aplicados} precios
              </p>
              {resultado.errores > 0 && (
                <p className="text-xs text-amber-600">{resultado.errores} con error</p>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {resultado ? (
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
                  disabled={leyendo || aplicando}
                >
                  Cancelar
                </Button>
                <Button
                  className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                  disabled={aprobados.size === 0 || aplicando}
                  onClick={handleAplicar}
                >
                  {aplicando ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Aplicando…
                    </>
                  ) : (
                    `Aplicar ${aprobados.size} precios`
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
