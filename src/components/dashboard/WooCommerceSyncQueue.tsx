import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useWooCommerceSyncQueue } from "@/hooks/use-woocommerce-sync-queue";
import type {
  WooSyncJob,
  WooSyncJobProduct,
  WooSyncJobStatus,
} from "@/lib/api/woocommerce-sync-queue";
import { cn } from "@/lib/utils";

function productFrom(job: WooSyncJob): WooSyncJobProduct | null {
  if (Array.isArray(job.muebles)) return job.muebles[0] ?? null;
  return job.muebles ?? null;
}

function formatDate(value?: string | null) {
  if (!value) return "Sin registro";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function statusLabel(status: WooSyncJobStatus) {
  if (status === "pending") return "Pendiente";
  if (status === "running") return "Sincronizando";
  if (status === "synced") return "Sincronizado";
  if (status === "failed") return "Error";
  return "Cancelado";
}

function statusIcon(status: WooSyncJobStatus) {
  if (status === "pending") return Clock;
  if (status === "running") return Loader2;
  if (status === "synced") return CheckCircle2;
  if (status === "failed") return XCircle;
  return AlertTriangle;
}

function statusClasses(status: WooSyncJobStatus) {
  if (status === "synced") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-red-200 bg-red-50 text-red-700";
  if (status === "running") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "canceled") return "border-slate-200 bg-slate-50 text-slate-500";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function WooCommerceSyncQueue() {
  const syncQueue = useWooCommerceSyncQueue();
  const jobs = syncQueue.queue.data?.jobs ?? [];
  const summary = syncQueue.queue.data?.summary ?? {
    pending: 0,
    running: 0,
    synced: 0,
    failed: 0,
    canceled: 0,
  };

  const handleProcessPending = async () => {
    const loading = toast.loading("Procesando cola de WooCommerce...");
    try {
      const processed = await syncQueue.processPending.mutateAsync(10);
      toast.dismiss(loading);

      if (processed.length === 0) {
        toast.info("No hay productos pendientes en la cola");
        return;
      }

      const failures = processed.filter((job) => job.status === "failed").length;
      if (failures > 0) {
        toast.error(`${failures} sincronización(es) terminaron con error`);
        return;
      }

      toast.success(`${processed.length} producto(s) sincronizado(s)`);
    } catch (error) {
      toast.dismiss(loading);
      const message = error instanceof Error ? error.message : "No fue posible procesar la cola";
      toast.error(message);
    }
  };

  const handleRetry = async (jobId: string) => {
    const loading = toast.loading("Reintentando sincronización...");
    try {
      const pendingJob = await syncQueue.retry.mutateAsync(jobId);
      const processedJob = await syncQueue.processJob.mutateAsync(pendingJob);
      toast.dismiss(loading);

      if (processedJob.status === "failed") {
        toast.error(processedJob.last_error || "La sincronización volvió a fallar");
        return;
      }

      toast.success("Producto sincronizado correctamente");
    } catch (error) {
      toast.dismiss(loading);
      const message = error instanceof Error ? error.message : "No fue posible reintentar";
      toast.error(message);
    }
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <CardTitle className="text-lg font-serif">Cola de sincronización WooCommerce</CardTitle>
            <CardDescription>
              Estado de envíos, errores y reintentos de productos hacia WooCommerce.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncQueue.queue.refetch()}
              disabled={syncQueue.queue.isFetching}
              className="gap-2"
            >
              {syncQueue.queue.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={handleProcessPending}
              disabled={syncQueue.isWorking || summary.pending === 0}
              className="gap-2 bg-slate-900 text-white"
            >
              {syncQueue.processPending.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Procesar pendientes
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              ["pending", "Pendientes"],
              ["running", "Activas"],
              ["synced", "Sincronizadas"],
              ["failed", "Errores"],
              ["canceled", "Canceladas"],
            ] as Array<[WooSyncJobStatus, string]>
          ).map(([status, label]) => (
            <div
              key={status}
              className="rounded-lg border border-slate-100 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-950"
            >
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </p>
              <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
                {summary[status]}
              </p>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          {syncQueue.queue.isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando cola
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 p-5 text-center text-sm text-slate-500 dark:border-slate-800">
              Todavía no hay sincronizaciones en cola.
            </div>
          ) : (
            jobs.map((job) => {
              const product = productFrom(job);
              const Icon = statusIcon(job.status);

              return (
                <div
                  key={job.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {product?.nombre ?? "Producto sin nombre"}
                      </p>
                      <Badge variant="outline" className={cn("gap-1", statusClasses(job.status))}>
                        <Icon
                          className={cn("h-3.5 w-3.5", job.status === "running" && "animate-spin")}
                        />
                        {statusLabel(job.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>{product?.categoria ?? "Sin categoría"}</span>
                      <span>Intentos: {job.attempts}</span>
                      <span>Solicitado: {formatDate(job.requested_at)}</span>
                      {job.finished_at && <span>Finalizado: {formatDate(job.finished_at)}</span>}
                    </div>
                    {job.last_error && (
                      <p className="mt-2 max-w-3xl text-sm text-red-600">{job.last_error}</p>
                    )}
                  </div>

                  {job.status === "failed" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRetry(job.id)}
                      disabled={syncQueue.isWorking}
                      className="gap-2"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reintentar
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
