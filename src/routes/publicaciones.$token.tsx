import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  PencilLine,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicacionesReview,
  setPublicacionDecision,
  type Decision,
  type PublicacionReview,
} from "@/lib/api/publicaciones-review";
import { getDisplayImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/publicaciones/$token")({
  head: () => ({
    meta: [
      { title: "Publicaciones Eleganzza | Autorizacion" },
      {
        name: "description",
        content: "Autoriza las publicaciones de redes sociales de Eleganzza.",
      },
    ],
  }),
  component: PublicacionesReviewPage,
});

const ESTADO_ESTILO: Record<string, { label: string; className: string }> = {
  en_revision: { label: "Pendiente de tu visto bueno", className: "bg-amber-100 text-amber-800" },
  aprobada: { label: "Aprobada", className: "bg-emerald-100 text-emerald-800" },
  cambios_solicitados: { label: "Pediste cambios", className: "bg-orange-100 text-orange-800" },
  rechazada: { label: "Rechazada", className: "bg-red-100 text-red-700" },
  publicada: { label: "Publicada", className: "bg-slate-200 text-slate-700" },
};

function formatFecha(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function esVideo(mimeType?: string) {
  return typeof mimeType === "string" && mimeType.startsWith("video/");
}

function PublicacionesReviewPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [reviewerName, setReviewerName] = useState("");
  const [comentarioAbierto, setComentarioAbierto] = useState<{
    publicacion: PublicacionReview;
    decision: Decision;
  } | null>(null);
  const [comentario, setComentario] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["publicaciones-review", token],
    queryFn: () => getPublicacionesReview(token),
  });

  const decisionMutation = useMutation({
    mutationFn: (input: { publicacionId: string; decision: Decision; comentario?: string }) =>
      setPublicacionDecision({
        token,
        publicacionId: input.publicacionId,
        decision: input.decision,
        ...(input.comentario ? { comentario: input.comentario } : {}),
        ...(reviewerName.trim() ? { reviewerName: reviewerName.trim() } : {}),
      }),
    onSuccess: async (_res, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["publicaciones-review", token] });
      setComentarioAbierto(null);
      setComentario("");
      toast.success(
        variables.decision === "aprobada"
          ? "Publicación aprobada"
          : variables.decision === "cambios_solicitados"
            ? "Enviamos tus comentarios"
            : "Publicación rechazada",
      );
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar tu decisión");
    },
  });

  const abrirComentario = (publicacion: PublicacionReview, decision: Decision) => {
    setComentario("");
    setComentarioAbierto({ publicacion, decision });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto" />
          <h1 className="text-xl font-semibold text-slate-800">No pudimos abrir el enlace</h1>
          <p className="text-sm text-slate-500">
            {error instanceof Error ? error.message : "Este enlace no está disponible."}
          </p>
        </div>
      </div>
    );
  }

  const pendientes = data.publicaciones.filter((p) => p.estado === "en_revision");
  const resueltas = data.publicaciones.filter((p) => p.estado !== "en_revision");

  return (
    <div className="min-h-screen bg-[#fcfbf8]">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-5 py-8">
          <p className="text-[11px] font-bold tracking-[0.2em] text-red-700 uppercase">
            {data.link.clientName ?? "Eleganzza Muebles"}
          </p>
          <h1 className="text-3xl font-bold text-slate-900 mt-2">{data.link.title}</h1>
          {data.link.introMessage && (
            <p className="text-sm text-slate-600 mt-2">{data.link.introMessage}</p>
          )}
          <p className="text-sm text-slate-500 mt-3">
            Revisa cada publicación y dinos si la autorizas, si quieres cambios o si no va.
          </p>

          <div className="mt-5 max-w-xs">
            <Label htmlFor="reviewer" className="text-xs text-slate-500">
              Tu nombre (opcional)
            </Label>
            <Input
              id="reviewer"
              value={reviewerName}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="¿Quién autoriza?"
              className="mt-1"
            />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-8">
        {data.publicaciones.length === 0 && (
          <div className="text-center py-16">
            <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto" />
            <p className="text-sm font-medium text-slate-700 mt-3">
              No hay publicaciones para revisar
            </p>
            <p className="text-xs text-slate-500 mt-1">Cuando subamos una nueva, aparecerá aquí.</p>
          </div>
        )}

        {pendientes.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Pendientes ({pendientes.length})
            </h2>
            {pendientes.map((publicacion) => (
              <PublicacionCard
                key={publicacion.id}
                publicacion={publicacion}
                onAprobar={() =>
                  decisionMutation.mutate({
                    publicacionId: publicacion.id,
                    decision: "aprobada",
                  })
                }
                onPedirCambios={() => abrirComentario(publicacion, "cambios_solicitados")}
                onRechazar={() => abrirComentario(publicacion, "rechazada")}
                trabajando={decisionMutation.isPending}
              />
            ))}
          </section>
        )}

        {resueltas.length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Ya revisadas ({resueltas.length})
            </h2>
            {resueltas.map((publicacion) => (
              <PublicacionCard key={publicacion.id} publicacion={publicacion} soloLectura />
            ))}
          </section>
        )}
      </main>

      <Dialog
        open={Boolean(comentarioAbierto)}
        onOpenChange={(open) => !open && setComentarioAbierto(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {comentarioAbierto?.decision === "cambios_solicitados"
                ? "¿Qué hay que cambiar?"
                : "¿Por qué la rechazas?"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">{comentarioAbierto?.publicacion.titulo}</p>
            <Textarea
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              rows={4}
              placeholder={
                comentarioAbierto?.decision === "cambios_solicitados"
                  ? "Ej: cambiar la foto por una del modelo en gris y quitar el precio."
                  : "Opcional, pero ayuda a entender el motivo."
              }
            />
            <Button
              className="w-full bg-[#1B3566] text-white hover:bg-[#132a52]"
              disabled={
                decisionMutation.isPending ||
                (comentarioAbierto?.decision === "cambios_solicitados" && !comentario.trim())
              }
              onClick={() =>
                comentarioAbierto &&
                decisionMutation.mutate({
                  publicacionId: comentarioAbierto.publicacion.id,
                  decision: comentarioAbierto.decision,
                  comentario: comentario.trim(),
                })
              }
            >
              {decisionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PublicacionCard({
  publicacion,
  onAprobar,
  onPedirCambios,
  onRechazar,
  trabajando,
  soloLectura,
}: {
  publicacion: PublicacionReview;
  onAprobar?: () => void;
  onPedirCambios?: () => void;
  onRechazar?: () => void;
  trabajando?: boolean;
  soloLectura?: boolean;
}) {
  const estado = ESTADO_ESTILO[publicacion.estado] ?? {
    label: publicacion.estado,
    className: "bg-slate-100 text-slate-600",
  };
  const fecha = formatFecha(publicacion.fechaProgramada);

  return (
    <article className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="grid gap-1 bg-slate-100">
        {publicacion.archivos.map((archivo) =>
          esVideo(archivo.mimeType) ? (
            <video
              key={archivo.id}
              src={getDisplayImageUrl(archivo)}
              controls
              className="w-full max-h-[520px] bg-black"
            />
          ) : (
            <img
              key={archivo.id}
              src={getDisplayImageUrl(archivo)}
              alt={publicacion.titulo}
              className="w-full object-cover"
              loading="lazy"
            />
          ),
        )}
      </div>

      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge className={cn("border-0 font-medium", estado.className)}>{estado.label}</Badge>
          {publicacion.canal && (
            <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-0">
              {publicacion.canal}
            </Badge>
          )}
          {fecha && (
            <span className="inline-flex items-center gap-1 text-xs text-slate-500">
              <CalendarDays className="h-3 w-3" />
              {fecha}
            </span>
          )}
        </div>

        <h3 className="text-lg font-semibold text-slate-900">{publicacion.titulo}</h3>

        {publicacion.copy && (
          <p className="text-sm text-slate-600 whitespace-pre-line">{publicacion.copy}</p>
        )}

        {publicacion.aprobadaPor && (
          <p className="text-xs text-emerald-700">Autorizada por {publicacion.aprobadaPor}</p>
        )}

        {publicacion.comentarios.length > 0 && (
          <div className="space-y-2 pt-2 border-t border-slate-100">
            {publicacion.comentarios
              .filter((c) => c.mensaje)
              .map((c) => (
                <div key={c.id} className="flex gap-2 text-xs text-slate-600">
                  <MessageSquareText className="h-3.5 w-3.5 text-slate-300 shrink-0 mt-0.5" />
                  <span>
                    {c.autor ? <strong>{c.autor}: </strong> : null}
                    {c.mensaje}
                  </span>
                </div>
              ))}
          </div>
        )}

        {!soloLectura && (
          <div className="grid grid-cols-3 gap-2 pt-2">
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
              disabled={trabajando}
              onClick={onAprobar}
            >
              <CheckCircle2 className="h-4 w-4" />
              Autorizar
            </Button>
            <Button
              variant="outline"
              disabled={trabajando}
              onClick={onPedirCambios}
              className="gap-1"
            >
              <PencilLine className="h-4 w-4" />
              Cambios
            </Button>
            <Button
              variant="outline"
              disabled={trabajando}
              onClick={onRechazar}
              className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
            >
              <XCircle className="h-4 w-4" />
              Rechazar
            </Button>
          </div>
        )}
      </div>
    </article>
  );
}
