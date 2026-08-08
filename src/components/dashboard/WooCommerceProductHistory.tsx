import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  ExternalLink,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useWooCommerceSyncHistory } from "@/hooks/use-woocommerce-sync-history";
import type { WooSyncHistoryEntry, WooSyncHistoryStatus } from "@/lib/api/woocommerce-sync-history";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

function formatDate(value?: string | null) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatMoney(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return "Sin precio";
  const numeric = Number(value);
  return Number.isFinite(numeric) ? currency.format(numeric) : String(value);
}

function statusLabel(status: WooSyncHistoryStatus) {
  if (status === "success") return "Correcto";
  if (status === "failed") return "Error";
  if (status === "pending") return "Pendiente";
  return "Omitido";
}

function statusClasses(status: WooSyncHistoryStatus) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

function eventTitle(entry: WooSyncHistoryEntry) {
  if (entry.event_type === "image_sync") return "Imágenes";
  if (entry.action === "created") return "Producto creado";
  if (entry.action === "updated") return "Producto actualizado";
  return "Producto sincronizado";
}

function changedLabel(field: string) {
  const labels: Record<string, string> = {
    name: "nombre",
    status: "estado",
    regular_price: "precio",
    category: "categoría",
    description: "descripción",
    images: "imágenes",
    woocommerce_metadata: "metadata Woo",
  };
  return labels[field] ?? field;
}

function FailedImages({ entry }: { entry: WooSyncHistoryEntry }) {
  const failedImages = entry.image_summary.failedImages ?? [];
  if (failedImages.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-red-100 bg-red-50/70 p-3">
      <p className="text-xs font-semibold text-red-700">Imágenes que fallaron</p>
      <div className="mt-2 space-y-1">
        {failedImages.slice(0, 5).map((image, index) => (
          <a
            key={`${image.src ?? image.sourceId ?? index}`}
            href={image.originalUrl ?? image.src ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-xs text-red-700 underline-offset-2 hover:underline"
          >
            {image.name ?? image.sourceId ?? image.src ?? `Imagen ${index + 1}`}
          </a>
        ))}
        {failedImages.length > 5 && (
          <p className="text-xs text-red-500">+{failedImages.length - 5} más</p>
        )}
      </div>
    </div>
  );
}

function HistoryEntry({ entry }: { entry: WooSyncHistoryEntry }) {
  const Icon = entry.event_type === "image_sync" ? Camera : PackageCheck;
  const sentPrice = entry.regular_price ?? entry.payload_summary.regularPrice ?? null;
  const sentCategory = entry.category_name ?? entry.payload_summary.categoryName ?? null;

  return (
    <div className="rounded-lg border border-slate-100 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 text-slate-500" />
            <p className="font-medium text-slate-900">{eventTitle(entry)}</p>
            <Badge variant="outline" className={cn("gap-1", statusClasses(entry.status))}>
              {entry.status === "success" ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : entry.status === "failed" ? (
                <AlertTriangle className="h-3.5 w-3.5" />
              ) : (
                <Clock className="h-3.5 w-3.5" />
              )}
              {statusLabel(entry.status)}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {entry.changed_by_email ?? "Usuario no registrado"} · {formatDate(entry.synced_at)}
          </p>
        </div>

        {entry.woo_permalink && (
          <Button variant="ghost" size="sm" asChild className="h-8 px-2">
            <a href={entry.woo_permalink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
            </a>
          </Button>
        )}
      </div>

      <p className="mt-3 text-sm text-slate-700">{entry.message}</p>

      {entry.error_message && (
        <p className="mt-2 rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
          {entry.error_message}
        </p>
      )}

      <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md bg-slate-50 p-2">
          <span className="block font-semibold text-slate-400">Precio enviado</span>
          <span className="text-slate-800">{formatMoney(sentPrice)}</span>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <span className="block font-semibold text-slate-400">Categoría enviada</span>
          <span className="text-slate-800">{sentCategory ?? "Sin categoría"}</span>
        </div>
        <div className="rounded-md bg-slate-50 p-2">
          <span className="block font-semibold text-slate-400">Imágenes</span>
          <span className="text-slate-800">
            {entry.image_summary.message ??
              `${entry.image_summary.total ?? entry.payload_summary.imageCount ?? 0} imagen(es)`}
          </span>
        </div>
      </div>

      {entry.changed_fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {entry.changed_fields.map((field) => (
            <Badge key={field} variant="secondary" className="text-[10px]">
              {changedLabel(field)}
            </Badge>
          ))}
        </div>
      )}

      <FailedImages entry={entry} />
    </div>
  );
}

export function WooCommerceProductHistory({ productId }: { productId: string }) {
  const history = useWooCommerceSyncHistory(productId);
  const entries = history.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Historial WooCommerce</p>
          <p className="text-xs text-slate-500">
            Cambios, usuario, fecha, precio, categoría e imágenes.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => history.refetch()}
          disabled={history.isFetching}
          className="h-8 gap-2"
        >
          {history.isFetching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock className="h-3.5 w-3.5" />
          )}
          Actualizar
        </Button>
      </div>

      {history.isLoading ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-white p-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando historial
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-center text-sm text-slate-500">
          Este producto todavía no tiene historial de sincronización.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <HistoryEntry key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
