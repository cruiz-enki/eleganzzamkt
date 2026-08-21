import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  Copy,
  Loader2,
  Link2,
  MessageSquareText,
  Plus,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  getPublicaciones,
  upsertPublicacion,
  deletePublicacion,
  setPublicacionEstado,
  getPublicacionComentarios,
  CANALES,
  ESTADO_LABEL,
  type Publicacion,
  type PublicacionArchivo,
  type PublicacionEstado,
} from "@/lib/api/publicaciones";
import { uploadPublicacionArchivo } from "@/lib/api/publicaciones.functions";
import { createCatalogReviewLink, getCatalogReviewLinks } from "@/lib/api/catalog-review";
import { getDisplayImageUrl } from "@/lib/image-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ESTADO_ESTILO: Record<PublicacionEstado, string> = {
  borrador: "bg-slate-100 text-slate-600",
  en_revision: "bg-amber-100 text-amber-800",
  aprobada: "bg-emerald-100 text-emerald-800",
  cambios_solicitados: "bg-orange-100 text-orange-800",
  rechazada: "bg-red-100 text-red-700",
  publicada: "bg-blue-100 text-blue-800",
};

const FILTROS: Array<{ id: "todas" | PublicacionEstado; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "borrador", label: "Borradores" },
  { id: "en_revision", label: "En revisión" },
  { id: "cambios_solicitados", label: "Con cambios" },
  { id: "aprobada", label: "Aprobadas" },
  { id: "publicada", label: "Publicadas" },
];

function leerBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("No se pudo leer el archivo"));
      const base64 = result.split(",")[1];
      if (!base64) return reject(new Error("Formato de archivo inválido"));
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("No se pudo leer el archivo"));
    reader.readAsDataURL(file);
  });
}

type Borrador = {
  id?: string;
  titulo: string;
  copy: string;
  canal: string;
  fechaProgramada: string;
  notas: string;
  archivos: PublicacionArchivo[];
};

const BORRADOR_VACIO: Borrador = {
  titulo: "",
  copy: "",
  canal: "",
  fechaProgramada: "",
  notas: "",
  archivos: [],
};

export function PublicacionesManager() {
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<"todas" | PublicacionEstado>("todas");
  const [editorAbierto, setEditorAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Borrador>(BORRADOR_VACIO);
  const [subiendo, setSubiendo] = useState(false);
  const [linkDialogAbierto, setLinkDialogAbierto] = useState(false);
  const [detalle, setDetalle] = useState<Publicacion | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: publicaciones = [], isLoading } = useQuery({
    queryKey: ["publicaciones"],
    queryFn: getPublicaciones,
  });

  const { data: enlaces = [] } = useQuery({
    queryKey: ["publicaciones-links"],
    queryFn: () => getCatalogReviewLinks("publicaciones"),
  });

  const { data: comentarios = [] } = useQuery({
    queryKey: ["publicacion-comentarios", detalle?.id],
    queryFn: () => getPublicacionComentarios(detalle!.id),
    enabled: Boolean(detalle?.id),
  });

  const invalidar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["publicaciones"] });
  };

  const guardarMutation = useMutation({
    mutationFn: () =>
      upsertPublicacion({
        ...(borrador.id ? { id: borrador.id } : {}),
        titulo: borrador.titulo.trim(),
        copy: borrador.copy.trim() || null,
        canal: borrador.canal || null,
        fechaProgramada: borrador.fechaProgramada || null,
        notas: borrador.notas.trim() || null,
        archivos: borrador.archivos,
      }),
    onSuccess: async () => {
      await invalidar();
      setEditorAbierto(false);
      setBorrador(BORRADOR_VACIO);
      toast.success("Publicación guardada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo guardar"),
  });

  const estadoMutation = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: PublicacionEstado }) =>
      setPublicacionEstado(id, estado),
    onSuccess: async () => {
      await invalidar();
      toast.success("Estado actualizado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const borrarMutation = useMutation({
    mutationFn: (id: string) => deletePublicacion(id),
    onSuccess: async () => {
      await invalidar();
      setDetalle(null);
      toast.success("Publicación eliminada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  const crearEnlaceMutation = useMutation({
    mutationFn: (input: { title: string; clientName: string; introMessage: string }) =>
      createCatalogReviewLink({
        tipo: "publicaciones",
        title: input.title,
        clientName: input.clientName,
        introMessage: input.introMessage,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["publicaciones-links"] });
      toast.success("Enlace creado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo crear"),
  });

  const handleArchivos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setSubiendo(true);
    try {
      const subidos: PublicacionArchivo[] = [...borrador.archivos];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;
        const base64 = await leerBase64(file);
        const subido = await uploadPublicacionArchivo({
          data: { fileName: file.name, mimeType: file.type || "image/jpeg", base64 },
        });
        subidos.push(subido);
      }
      setBorrador((prev) => ({ ...prev, archivos: subidos }));
      toast.success("Archivos subidos");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron subir los archivos");
    } finally {
      setSubiendo(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const abrirEditor = (publicacion?: Publicacion) => {
    setBorrador(
      publicacion
        ? {
            id: publicacion.id,
            titulo: publicacion.titulo,
            copy: publicacion.copy ?? "",
            canal: publicacion.canal ?? "",
            fechaProgramada: publicacion.fecha_programada ?? "",
            notas: publicacion.notas ?? "",
            archivos: publicacion.archivos ?? [],
          }
        : BORRADOR_VACIO,
    );
    setEditorAbierto(true);
  };

  const visibles = useMemo(
    () => (filtro === "todas" ? publicaciones : publicaciones.filter((p) => p.estado === filtro)),
    [publicaciones, filtro],
  );

  const enlaceActivo = enlaces.find((l) => l.is_active);
  const urlPortal = enlaceActivo
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/publicaciones/${enlaceActivo.token}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white">Publicaciones</h2>
          <p className="text-sm text-slate-500">
            Sube la publicación, mándala a revisión y Eleganzza la autoriza desde su enlace.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-slate-200"
            onClick={() => setLinkDialogAbierto(true)}
          >
            <Link2 className="h-4 w-4 mr-2" />
            Enlace de aprobación
          </Button>
          <Button
            size="sm"
            className="h-9 bg-[#1B3566] text-white hover:bg-[#132a52]"
            onClick={() => abrirEditor()}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nueva publicación
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => {
          const conteo =
            f.id === "todas"
              ? publicaciones.length
              : publicaciones.filter((p) => p.estado === f.id).length;
          return (
            <button
              key={f.id}
              onClick={() => setFiltro(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                filtro === f.id
                  ? "bg-[#1B3566] text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200",
              )}
            >
              {f.label} ({conteo})
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      ) : visibles.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
          <p className="text-sm text-slate-500">No hay publicaciones aquí.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((p) => (
            <div
              key={p.id}
              className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 flex flex-col"
            >
              <button
                className="aspect-square bg-slate-100 dark:bg-slate-800 overflow-hidden"
                onClick={() => setDetalle(p)}
              >
                {p.archivos?.[0] ? (
                  <img
                    src={getDisplayImageUrl(p.archivos[0])}
                    alt={p.titulo}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">
                    Sin archivo
                  </div>
                )}
              </button>

              <div className="p-3 space-y-2 flex-1 flex flex-col">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge className={cn("border-0 text-[10px]", ESTADO_ESTILO[p.estado])}>
                    {ESTADO_LABEL[p.estado]}
                  </Badge>
                  {p.canal && (
                    <Badge
                      variant="secondary"
                      className="bg-slate-100 dark:bg-slate-800 text-slate-500 border-0 text-[10px]"
                    >
                      {p.canal}
                    </Badge>
                  )}
                </div>

                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-2">
                  {p.titulo}
                </p>

                {p.fecha_programada && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                    <CalendarDays className="h-3 w-3" />
                    {p.fecha_programada}
                  </span>
                )}

                {p.aprobada_por && (p.estado === "aprobada" || p.estado === "publicada") && (
                  <span className="text-[11px] text-emerald-700">Autorizó {p.aprobada_por}</span>
                )}

                <div className="flex gap-1.5 pt-1 mt-auto">
                  {p.estado === "borrador" || p.estado === "cambios_solicitados" ? (
                    <Button
                      size="sm"
                      className="h-8 flex-1 bg-[#1B3566] text-white hover:bg-[#132a52] text-xs"
                      disabled={estadoMutation.isPending || (p.archivos ?? []).length === 0}
                      onClick={() => estadoMutation.mutate({ id: p.id, estado: "en_revision" })}
                    >
                      <Send className="h-3 w-3 mr-1" />A revisión
                    </Button>
                  ) : p.estado === "aprobada" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs"
                      disabled={estadoMutation.isPending}
                      onClick={() => estadoMutation.mutate({ id: p.id, estado: "publicada" })}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Ya publicada
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 text-xs"
                      onClick={() => setDetalle(p)}
                    >
                      Ver
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 px-2 text-slate-400"
                    onClick={() => abrirEditor(p)}
                  >
                    Editar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <Dialog open={editorAbierto} onOpenChange={setEditorAbierto}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{borrador.id ? "Editar publicación" : "Nueva publicación"}</DialogTitle>
            <DialogDescription>
              Sube la imagen o el video, escribe el copy y mándala a revisión cuando esté lista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="titulo">Título interno</Label>
              <Input
                id="titulo"
                value={borrador.titulo}
                onChange={(e) => setBorrador({ ...borrador, titulo: e.target.value })}
                placeholder="Ej: Post Sala Boston — oferta de agosto"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="canal">Red social</Label>
                <select
                  id="canal"
                  value={borrador.canal}
                  onChange={(e) => setBorrador({ ...borrador, canal: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
                >
                  <option value="">Sin definir</option>
                  {CANALES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="fecha">Fecha propuesta</Label>
                <Input
                  id="fecha"
                  type="date"
                  value={borrador.fechaProgramada}
                  onChange={(e) => setBorrador({ ...borrador, fechaProgramada: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="copy">Copy de la publicación</Label>
              <Textarea
                id="copy"
                rows={5}
                value={borrador.copy}
                onChange={(e) => setBorrador({ ...borrador, copy: e.target.value })}
                placeholder="El texto que va a acompañar la imagen…"
              />
            </div>

            <div>
              <Label>Archivos</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {borrador.archivos.map((archivo, idx) => (
                  <div key={archivo.id} className="relative">
                    <img
                      src={getDisplayImageUrl(archivo)}
                      alt={archivo.nombre ?? ""}
                      className="h-20 w-20 object-cover rounded-lg border border-slate-200"
                    />
                    <button
                      type="button"
                      className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 shadow-sm"
                      onClick={() =>
                        setBorrador({
                          ...borrador,
                          archivos: borrador.archivos.filter((_, i) => i !== idx),
                        })
                      }
                    >
                      <X className="h-3 w-3 text-slate-500" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={subiendo}
                  className="h-20 w-20 rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:border-slate-400"
                >
                  {subiendo ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      <span className="text-[10px] mt-1">Subir</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleArchivos}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="notas">Notas internas (no las ve el cliente)</Label>
              <Textarea
                id="notas"
                rows={2}
                value={borrador.notas}
                onChange={(e) => setBorrador({ ...borrador, notas: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditorAbierto(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1B3566] text-white hover:bg-[#132a52]"
              disabled={!borrador.titulo.trim() || guardarMutation.isPending || subiendo}
              onClick={() => guardarMutation.mutate()}
            >
              {guardarMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detalle con la bitácora del cliente */}
      <Dialog open={Boolean(detalle)} onOpenChange={(open) => !open && setDetalle(null)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalle?.titulo}</DialogTitle>
          </DialogHeader>
          {detalle && (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge className={cn("border-0", ESTADO_ESTILO[detalle.estado])}>
                  {ESTADO_LABEL[detalle.estado]}
                </Badge>
                {detalle.canal && (
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0">
                    {detalle.canal}
                  </Badge>
                )}
              </div>

              {detalle.archivos?.[0] && (
                <img
                  src={getDisplayImageUrl(detalle.archivos[0])}
                  alt={detalle.titulo}
                  className="w-full rounded-lg border border-slate-200"
                />
              )}

              {detalle.copy && (
                <p className="text-sm text-slate-600 whitespace-pre-line">{detalle.copy}</p>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Historial de revisión
                </h4>
                {comentarios.length === 0 ? (
                  <p className="text-xs text-slate-400">Todavía no hay decisiones del cliente.</p>
                ) : (
                  comentarios.map((c) => (
                    <div key={c.id} className="flex gap-2 text-xs text-slate-600">
                      <MessageSquareText className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                      <span>
                        <strong>{ESTADO_LABEL[c.tipo as PublicacionEstado] ?? c.tipo}</strong>
                        {c.autor ? ` · ${c.autor}` : ""}
                        {c.mensaje ? `: ${c.mensaje}` : ""}
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                {detalle.estado !== "borrador" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => estadoMutation.mutate({ id: detalle.id, estado: "borrador" })}
                  >
                    Regresar a borrador
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 ml-auto"
                  onClick={() => borrarMutation.mutate(detalle.id)}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Enlace de aprobación */}
      <Dialog open={linkDialogAbierto} onOpenChange={setLinkDialogAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enlace de aprobación</DialogTitle>
            <DialogDescription>
              Con este enlace Eleganzza entra desde su celular, sin contraseña, y autoriza las
              publicaciones que estén en revisión.
            </DialogDescription>
          </DialogHeader>

          {urlPortal ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input readOnly value={urlPortal} className="text-xs" />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(urlPortal);
                    toast.success("Enlace copiado");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-slate-500">
                Enlace activo: {enlaceActivo?.title}. Puedes desactivarlo desde Configuración.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Todavía no hay un enlace de publicaciones.</p>
              <Button
                className="bg-[#1B3566] text-white hover:bg-[#132a52]"
                disabled={crearEnlaceMutation.isPending}
                onClick={() =>
                  crearEnlaceMutation.mutate({
                    title: "Publicaciones para autorizar",
                    clientName: "Eleganzza Muebles",
                    introMessage:
                      "Aquí van las publicaciones propuestas. Autoriza las que te gusten o pide cambios.",
                  })
                }
              >
                {crearEnlaceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Crear enlace"
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
