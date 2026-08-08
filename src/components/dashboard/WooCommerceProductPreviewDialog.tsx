import { AlertTriangle, ExternalLink, ImageIcon, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WooProductPreviewResult, WooProductPreviewSuccess } from "@/lib/api/woocommerce";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Sin precio";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? currency.format(numeric) : String(value);
}

function textPreview(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Sin dato";
  return String(value);
}

function ProductSummary({ preview }: { preview: WooProductPreviewSuccess }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Nombre</p>
        <p className="mt-1 font-medium text-slate-900">{preview.product.nombre}</p>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Precio</p>
        <p className="mt-1 font-medium text-slate-900">{formatMoney(preview.product.precio)}</p>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Categoría</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-900">
            {preview.product.categoria ?? "Sin categoría"}
          </span>
          {preview.category.willCreate && (
            <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
              Se creará
            </Badge>
          )}
          {preview.category.exists && (
            <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
              Existe en Woo
            </Badge>
          )}
        </div>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Estado Woo</p>
        <p className="mt-1 font-medium text-slate-900">{preview.product.status}</p>
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50 p-3 md:col-span-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Descripción</p>
        <p className="mt-1 line-clamp-5 whitespace-pre-line text-sm text-slate-700">
          {preview.product.descripcion || "Sin descripción"}
        </p>
      </div>
    </div>
  );
}

function Changes({ preview }: { preview: WooProductPreviewSuccess }) {
  if (preview.changes.length === 0) {
    return (
      <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700">
        No se detectaron cambios contra el producto actual en WooCommerce.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-100">
      <div className="grid grid-cols-[0.8fr_1fr_1fr] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>Campo</span>
        <span>Actual en Woo</span>
        <span>Se enviará</span>
      </div>
      {preview.changes.map((change) => (
        <div
          key={change.field}
          className="grid grid-cols-[0.8fr_1fr_1fr] gap-2 border-t border-slate-100 px-3 py-2 text-sm"
        >
          <span className="font-medium text-slate-700">{change.field}</span>
          <span className="truncate text-slate-500">{textPreview(change.current)}</span>
          <span className="truncate text-slate-900">{textPreview(change.next)}</span>
        </div>
      ))}
    </div>
  );
}

function Images({ preview }: { preview: WooProductPreviewSuccess }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-900">Imágenes</p>
        <Badge variant="secondary">
          {preview.images.total}/{preview.images.max}
        </Badge>
      </div>

      {preview.images.items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
          Este producto no tiene imágenes listas para WooCommerce.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {preview.images.items.slice(0, 10).map((image) => (
            <a
              key={image.src}
              href={image.originalUrl ?? image.src}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-md border border-slate-100 bg-slate-50"
            >
              <img src={image.src} alt={image.alt} className="h-full w-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 hidden bg-black/60 px-1 py-0.5 text-[10px] text-white group-hover:block">
                {image.name}
              </span>
            </a>
          ))}
          {preview.images.items.length > 10 && (
            <div className="flex aspect-square items-center justify-center rounded-md border border-slate-100 bg-slate-50 text-xs text-slate-500">
              +{preview.images.items.length - 10}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type Props = {
  open: boolean;
  preview: WooProductPreviewResult | null;
  isLoading: boolean;
  isSyncing: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
};

export function WooCommerceProductPreviewDialog({
  open,
  preview,
  isLoading,
  isSyncing,
  onOpenChange,
  onConfirm,
}: Props) {
  const successPreview = preview?.success ? preview : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">Vista previa WooCommerce</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparando vista previa
          </div>
        ) : !preview ? (
          <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500">
            No hay vista previa disponible.
          </div>
        ) : !preview.success ? (
          <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4" />
              No fue posible generar la vista previa
            </div>
            <p className="mt-2">{preview.message}</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">
                  {preview.action === "created"
                    ? "Se creará un producto nuevo"
                    : "Se actualizará el producto existente"}
                </p>
                <p className="text-xs text-slate-500">{preview.message}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  className={
                    preview.action === "created"
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
                  }
                >
                  {preview.action === "created" ? "Crear" : "Actualizar"}
                </Badge>
                {preview.permalink && (
                  <Button variant="outline" size="sm" asChild className="gap-2">
                    <a href={preview.permalink} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Ver Woo
                    </a>
                  </Button>
                )}
              </div>
            </div>

            <ProductSummary preview={preview} />

            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-900">Lo que va a cambiar</p>
              <Changes preview={preview} />
            </div>

            <Images preview={preview} />

            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ImageIcon className="h-4 w-4" />
                Payload resumido
              </p>
              <div className="grid gap-2 text-xs sm:grid-cols-2">
                <span>Nombre: {preview.payloadPreview.name}</span>
                <span>Precio: {formatMoney(preview.payloadPreview.regular_price)}</span>
                <span>Estado: {preview.payloadPreview.status}</span>
                <span>Stock: sin control de inventario</span>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSyncing}>
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={!successPreview || isLoading || isSyncing}
            className="gap-2 bg-blue-600 text-white hover:bg-blue-700"
          >
            {isSyncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Confirmar envío
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
