import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  ImageIcon,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { inspectImage, normalizeManagedImage, type ManagedImage } from "@/lib/image-url";

type ImageRecord = {
  id?: string;
  url?: string;
  name?: string;
  mimeType?: string;
  [key: string]: unknown;
};

type Props = {
  images: unknown[] | null | undefined;
  productName: string;
  readOnly?: boolean;
  isBusy?: boolean;
  onChange?: (images: ImageRecord[]) => void;
  onReimport?: () => void;
  onAnalyze?: (url: string) => void;
};

function asImageRecord(value: unknown): ImageRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ImageRecord;
}

function brokenReason(image: ManagedImage, failed: boolean) {
  if (image.reason) return image.reason;
  if (!failed) return null;
  if (image.sourceType === "drive") {
    return "Drive no entregó la imagen. Puede faltar permiso público, token válido o el archivo fue eliminado.";
  }
  if (image.sourceType === "url") {
    return "La URL no cargó. Puede estar bloqueada, caducada o no devolver una imagen.";
  }
  return "No hay una fuente válida para mostrar esta imagen.";
}

function sourceLabel(image: ManagedImage) {
  if (image.sourceType === "drive") return "Drive";
  if (image.sourceType === "url") return "URL";
  return "Inválida";
}

export function ProductImageManager({
  images,
  productName,
  readOnly = false,
  isBusy = false,
  onChange,
  onReimport,
  onAnalyze,
}: Props) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const normalizedImages = useMemo(
    () => (Array.isArray(images) ? images.map(asImageRecord) : []),
    [images],
  );

  const inspectedImages = useMemo(
    () => normalizedImages.map((image) => inspectImage(image)),
    [normalizedImages],
  );

  const brokenCount = inspectedImages.filter((image) =>
    Boolean(brokenReason(image, failedImages.has(image.displayUrl || image.sourceUrl))),
  ).length;

  const emit = (nextImages: ImageRecord[]) => {
    onChange?.(nextImages.map((image) => normalizeManagedImage(image) as ImageRecord));
  };

  const moveImage = (from: number, to: number) => {
    if (readOnly || !onChange || to < 0 || to >= normalizedImages.length) return;
    const next = [...normalizedImages];
    const [item] = next.splice(from, 1);
    if (!item) return;
    next.splice(to, 0, item);
    emit(next);
  };

  const removeImage = (index: number) => {
    if (readOnly || !onChange) return;
    emit(normalizedImages.filter((_, imageIndex) => imageIndex !== index));
  };

  const setPrimary = (index: number) => moveImage(index, 0);

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Gestión de imágenes</p>
          <p className="text-xs text-slate-500">
            Imagen principal, orden de galería, diagnóstico y reimportación desde Drive.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              brokenCount > 0
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }
          >
            {brokenCount > 0 ? `${brokenCount} rota(s)` : "Sin rotas detectadas"}
          </Badge>
          {onReimport && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReimport}
              disabled={isBusy}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reimportar Drive
            </Button>
          )}
        </div>
      </div>

      {inspectedImages.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400">
          <ImageIcon className="h-8 w-8 opacity-40" />
          <span className="mt-2 text-xs font-medium">Sin imágenes disponibles</span>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {inspectedImages.map((image, index) => {
            const failedKey = image.displayUrl || image.sourceUrl || `${index}`;
            const failed = failedImages.has(failedKey);
            const reason = brokenReason(image, failed);

            return (
              <div
                key={`${image.driveId ?? image.sourceUrl ?? index}-${index}`}
                className={cn(
                  "overflow-hidden rounded-lg border bg-white",
                  reason ? "border-red-200" : "border-slate-100",
                )}
              >
                <div className="relative aspect-square bg-slate-100">
                  {image.displayUrl && !failed ? (
                    <img
                      src={image.displayUrl}
                      alt={`${productName} ${index + 1}`}
                      className="h-full w-full object-cover"
                      onError={() => setFailedImages((current) => new Set(current).add(failedKey))}
                    />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center text-slate-400">
                      <AlertTriangle className="h-7 w-7 text-red-400" />
                      <span className="text-xs font-medium">No carga</span>
                    </div>
                  )}

                  {index === 0 && (
                    <Badge className="absolute left-2 top-2 gap-1 bg-black text-white">
                      <Star className="h-3 w-3 fill-current" />
                      Principal
                    </Badge>
                  )}

                  <Badge
                    variant="secondary"
                    className="absolute bottom-2 left-2 bg-white/90 text-[10px] text-slate-700"
                  >
                    {sourceLabel(image)}
                  </Badge>
                </div>

                <div className="space-y-3 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {image.name || `Imagen ${index + 1}`}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {image.driveId ?? image.sourceUrl ?? "Sin origen"}
                    </p>
                  </div>

                  {reason && (
                    <div className="rounded-md border border-red-100 bg-red-50 p-2 text-xs text-red-700">
                      {reason}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {!readOnly && (
                      <>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPrimary(index)}
                          disabled={index === 0 || isBusy}
                          title="Usar como principal"
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveImage(index, index - 1)}
                          disabled={index === 0 || isBusy}
                          title="Mover arriba"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => moveImage(index, index + 1)}
                          disabled={index === inspectedImages.length - 1 || isBusy}
                          title="Mover abajo"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => removeImage(index)}
                          disabled={isBusy}
                          title="Eliminar de la galería"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {image.sourceUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a
                          href={image.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir origen"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {onAnalyze && image.displayUrl && !failed && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={() => onAnalyze(image.displayUrl)}
                        disabled={isBusy}
                      >
                        IA
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
