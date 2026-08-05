import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { CheckCircle2, Loader2, LogOut, PlugZap, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWooCommerceConnection } from "@/hooks/use-woocommerce-connection";
import { supabase } from "@/lib/supabase-client";
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
  const [session, setSession] = useState<Session | null>(null);
  const [authEmail, setAuthEmail] = useState("cruiz@enkisoluciones.mx");
  const [isSendingLink, setIsSendingLink] = useState(false);
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.email) setAuthEmail(data.session.user.email);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.user.email) setAuthEmail(nextSession.user.email);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const status = useMemo<WooConnectionStatus>(() => {
    if (!lastResult) return "untested";
    return lastResult.success ? "connected" : "error";
  }, [lastResult]);

  const handleTestConnection = async () => {
    if (!session) {
      toast.error("Inicia sesión en Supabase antes de probar WooCommerce");
      return;
    }

    const result = await connection.mutateAsync();
    setLastResult(result);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(result));

    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleSendAccessLink = async () => {
    const email = authEmail.trim();
    if (!email) {
      toast.error("Ingresa un correo para recibir el enlace de acceso");
      return;
    }

    setIsSendingLink(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      toast.success("Enlace de acceso enviado");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo enviar el enlace";
      toast.error(message);
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast.success("Sesión cerrada");
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
        <div className="rounded-md border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-950/40">
          {session ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Sesión Supabase
                </p>
                <p className="mt-1 text-sm font-medium text-slate-700 dark:text-slate-200">
                  {session.user.email}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                Cerrar sesión
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Correo administrador
                </Label>
                <Input
                  type="email"
                  value={authEmail}
                  onChange={(event) => setAuthEmail(event.target.value)}
                />
              </div>
              <Button variant="outline" onClick={handleSendAccessLink} disabled={isSendingLink}>
                {isSendingLink ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando
                  </>
                ) : (
                  "Enviar enlace de acceso"
                )}
              </Button>
            </div>
          )}
        </div>

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
          disabled={connection.isPending || !session}
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
