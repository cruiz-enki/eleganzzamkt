import {
  AlertTriangle,
  CheckCircle2,
  Cloud,
  Database,
  Loader2,
  RefreshCw,
  Server,
  Sparkles,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSystemHealth } from "@/hooks/use-system-health";
import type { SystemHealthItem, SystemHealthService } from "@/lib/api/system-health";
import { cn } from "@/lib/utils";

function formatDate(value?: string | null) {
  if (!value) return "Sin registro";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function serviceIcon(service: SystemHealthService) {
  if (service === "supabase") return Database;
  if (service === "woocommerce") return Server;
  if (service === "google_drive") return Cloud;
  return Sparkles;
}

function statusLabel(status: SystemHealthItem["status"]) {
  if (status === "healthy") return "Operando";
  if (status === "warning") return "Atención";
  return "Error";
}

function statusIcon(status: SystemHealthItem["status"]) {
  if (status === "healthy") return CheckCircle2;
  if (status === "warning") return AlertTriangle;
  return XCircle;
}

function statusClasses(status: SystemHealthItem["status"]) {
  if (status === "healthy") {
    return {
      badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
      icon: "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }

  if (status === "warning") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      icon: "bg-amber-50 text-amber-700 border-amber-200",
    };
  }

  return {
    badge: "border-red-200 bg-red-50 text-red-700",
    icon: "bg-red-50 text-red-700 border-red-200",
  };
}

function detailEntries(item: SystemHealthItem) {
  return Object.entries(item.details ?? {}).filter(([, value]) => value !== null && value !== "");
}

function formatDetail(key: string, value: string | number | boolean | null) {
  if (value === null) return "";

  const labels: Record<string, string> = {
    cuenta: "Cuenta",
    estadoHttp: "HTTP",
    erroresImagenesWoo: "Errores de imágenes",
    model: "Modelo",
    productos: "Productos",
    productosSincronizadosWoo: "Productos en Woo",
    tienda: "Tienda",
    ultimaSincronizacionWoo: "Última sync Woo",
  };

  const normalizedValue =
    key.toLowerCase().includes("fecha") || key.toLowerCase().includes("sincronizacion")
      ? formatDate(String(value))
      : String(value);

  return `${labels[key] ?? key}: ${normalizedValue}`;
}

export function SystemHealthPanel() {
  const health = useSystemHealth();

  const items = health.data?.items ?? [];
  const hasErrors = items.some((item) => item.status === "error");
  const hasWarnings = items.some((item) => item.status === "warning");
  const overallStatus = hasErrors ? "error" : hasWarnings ? "warning" : "healthy";
  const OverallIcon = statusIcon(overallStatus);
  const overallClasses = statusClasses(overallStatus);

  const handleRefresh = async () => {
    const result = await health.refetch();
    const nextItems = result.data?.items ?? [];

    if (nextItems.some((item) => item.status === "error")) {
      toast.error("Hay servicios que requieren revisión");
      return;
    }

    if (nextItems.some((item) => item.status === "warning")) {
      toast.warning("El sistema respondió con advertencias");
      return;
    }

    toast.success("Todos los servicios respondieron correctamente");
  };

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                "rounded-lg border p-2",
                health.isLoading ? "border-slate-200 bg-white text-slate-500" : overallClasses.icon,
              )}
            >
              {health.isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <OverallIcon className="h-4 w-4" />
              )}
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Salud del sistema</CardTitle>
              <CardDescription>
                Estado operativo de Supabase, WooCommerce, Drive y OpenAI.
              </CardDescription>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!health.isLoading && (
              <Badge variant="outline" className={cn("w-fit", overallClasses.badge)}>
                {statusLabel(overallStatus)}
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={health.isFetching}
              className="gap-2"
            >
              {health.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Revisar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-2">
          {health.isLoading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-32 animate-pulse rounded-lg border border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-900"
                />
              ))
            : items.map((item) => {
                const Icon = serviceIcon(item.service);
                const StateIcon = statusIcon(item.status);
                const classes = statusClasses(item.status);
                const details = detailEntries(item);

                return (
                  <div
                    key={item.service}
                    className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white">{item.label}</p>
                          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                            {item.message}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={cn("shrink-0 gap-1", classes.badge)}>
                        <StateIcon className="h-3.5 w-3.5" />
                        {statusLabel(item.status)}
                      </Badge>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span>Revisado: {formatDate(item.checkedAt)}</span>
                      {typeof item.latencyMs === "number" && <span>{item.latencyMs} ms</span>}
                    </div>

                    {details.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {details.map(([key, value]) => (
                          <span
                            key={key}
                            className="rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300"
                          >
                            {formatDetail(key, value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
        </div>

        {health.data?.checkedAt && (
          <p className="text-xs text-slate-400">
            Última revisión general: {formatDate(health.data.checkedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
