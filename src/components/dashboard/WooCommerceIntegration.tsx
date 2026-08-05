import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWooCommerceConnection } from "@/hooks/use-woocommerce-connection";
import type { WooConnectionResult, WooConnectionStatus } from "@/lib/api/woocommerce";

const STORAGE_KEY = "eleganzza_woocommerce_connection";

function formatCheckedAt(value?: string) {
  if (!value) return "Sin pruebas";

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getStatusLabel(status: WooConnectionStatus) {
  if (status === "connected") return "Conectado";
  if (status === "error") return "Error";
  return "No probado";
}

export function WooCommerceIntegration() {
  const [lastResult, setLastResult] = useState<WooConnectionResult | null>(null);
  const connection = useWooCommerceConnection();

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      setLastResult(JSON.parse(saved) as WooConnectionResult);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const status = useMemo<WooConnectionStatus>(() => {
    if (!lastResult) return "untested";
    return lastResult.success ? "connected" : "error";
  }, [lastResult]);

  const handleTestConnection = async () => {
    const result = await connection.mutateAsync();
    setLastResult(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const storeUrl = lastResult?.success ? lastResult.storeUrl : "";
  const checkedAt = lastResult?.checkedAt;
  const errorMessage = lastResult && !lastResult.success ? lastResult.message : "";

  return (
    <Card className="border-slate-200 dark:border-slate-800">
      <CardHeader className="bg-slate-50/50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <PlugZap className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg font-serif">Integración con WooCommerce</CardTitle>
              <CardDescription>Prueba segura vía Supabase Edge Function.</CardDescription>
            </div>
          </div>
          <Badge
            variant={
              status === "connected" ? "default" : status === "error" ? "destructive" : "outline"
            }
            className="w-fit"
          >
            {getStatusLabel(status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 pt-6">
        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              URL de la tienda
            </Label>
            <Input
              value={storeUrl}
              readOnly
              placeholder="Se mostrará después de probar la conexión"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Última prueba
            </Label>
            <div className="flex h-10 items-center rounded-md border border-slate-200 px-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
              {formatCheckedAt(checkedAt)}
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {status === "connected" && (
          <div className="flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <span>La tienda respondió correctamente al endpoint de estado.</span>
          </div>
        )}

        <Button
          onClick={handleTestConnection}
          disabled={connection.isPending}
          className="bg-slate-900 text-white"
        >
          {connection.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Probando
            </>
          ) : (
            "Probar conexión"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
