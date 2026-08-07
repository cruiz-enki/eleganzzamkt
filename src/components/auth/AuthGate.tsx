import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { KeyRound, Loader2, LogOut, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase-client";

const ALLOWED_EMAIL = "cruiz@enkisoluciones.mx";
const PRODUCTION_APP_URL = "https://eleganzzamkt.enkidad.com";

function normalizeEmail(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function isAllowedSession(session: Session | null) {
  return normalizeEmail(session?.user.email) === ALLOWED_EMAIL;
}

function getAuthRedirectUrl() {
  const configuredUrl = import.meta.env["VITE_PUBLIC_APP_URL"];

  if (typeof configuredUrl === "string" && configuredUrl.startsWith("https://")) {
    return configuredUrl.replace(/\/$/, "");
  }

  if (typeof window === "undefined") return PRODUCTION_APP_URL;

  const isLocalhost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  return isLocalhost ? PRODUCTION_APP_URL : window.location.origin;
}

function getPasswordRecoveryRedirectUrl() {
  const redirectUrl = new URL(getAuthRedirectUrl());
  redirectUrl.searchParams.set("auth_action", "recovery");
  return redirectUrl.toString();
}

function isPasswordRecoveryRedirect() {
  if (typeof window === "undefined") return false;

  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));

  return (
    searchParams.get("auth_action") === "recovery" ||
    searchParams.get("type") === "recovery" ||
    hashParams.get("auth_action") === "recovery" ||
    hashParams.get("type") === "recovery"
  );
}

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState(ALLOWED_EMAIL);
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isRecoveryMode, setIsRecoveryMode] = useState(isPasswordRecoveryRedirect);

  const isAllowed = useMemo(() => isAllowedSession(session), [session]);
  const signedEmail = normalizeEmail(session?.user.email);

  useEffect(() => {
    let mounted = true;
    const startedFromPasswordRecovery = isPasswordRecoveryRedirect();

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (startedFromPasswordRecovery && data.session) {
        setIsRecoveryMode(true);
      }
      setSession(data.session);
      setIsLoadingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecoveryMode(true);
      }

      setSession(nextSession);
      setIsLoadingSession(false);
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || isAllowed) return;

    supabase.auth.signOut().finally(() => {
      setSession(null);
      toast.error("Esta aplicación solo está habilitada para cruiz@enkisoluciones.mx");
    });
  }, [isAllowed, session]);

  const handlePasswordSignIn = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail !== ALLOWED_EMAIL) {
      toast.error("Solo cruiz@enkisoluciones.mx puede acceder a esta aplicación");
      return;
    }

    if (!password) {
      toast.error("Ingresa tu contraseña");
      return;
    }

    setIsSigningIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (error) throw error;

      if (!isAllowedSession(data.session)) {
        await supabase.auth.signOut();
        setSession(null);
        toast.error("Esta aplicación solo está habilitada para cruiz@enkisoluciones.mx");
        return;
      }

      setPassword("");
      toast.success("Sesión iniciada");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible iniciar sesión";
      toast.error(message);
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    const normalizedEmail = normalizeEmail(email);

    if (normalizedEmail !== ALLOWED_EMAIL) {
      toast.error("Solo cruiz@enkisoluciones.mx puede acceder a esta aplicación");
      return;
    }

    setIsSendingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getPasswordRecoveryRedirectUrl(),
      });

      if (error) throw error;
      toast.success("Te envié un enlace para restablecer tu contraseña.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible enviar el enlace de recuperación";
      toast.error(message);
    } finally {
      setIsSendingRecovery(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast.error("La nueva contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      setPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setIsRecoveryMode(false);
      window.history.replaceState({}, document.title, window.location.pathname);
      toast.success("Contraseña actualizada. Tu sesión quedó iniciada.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No fue posible actualizar la contraseña";
      toast.error(message);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    toast.success("Sesión cerrada");
  };

  if (isLoadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8] text-slate-600 dark:bg-slate-950 dark:text-slate-300">
        <div className="flex items-center gap-3 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" />
          Validando sesión
        </div>
      </div>
    );
  }

  if (isAllowed && !isRecoveryMode) {
    return (
      <div className="min-h-screen">
        <div className="fixed right-4 top-4 z-[60] hidden items-center gap-2 rounded-md border border-slate-200 bg-white/90 px-3 py-2 text-xs text-slate-600 shadow-sm backdrop-blur md:flex dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{signedEmail}</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleSignOut}>
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fcfbf8] px-4 py-10 dark:bg-slate-950">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6 flex items-start gap-3">
          <div className="rounded-md bg-red-50 p-2 text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-semibold text-slate-950 dark:text-white">
              Eleganzza Marketing
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Acceso privado para cruiz@enkisoluciones.mx.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          {isRecoveryMode ? (
            <>
              <div className="space-y-2">
                <Label
                  htmlFor="auth-new-password"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Nueva contraseña
                </Label>
                <Input
                  id="auth-new-password"
                  type="password"
                  value={newPassword}
                  autoComplete="new-password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleUpdatePassword();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="auth-confirm-password"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Confirmar contraseña
                </Label>
                <Input
                  id="auth-confirm-password"
                  type="password"
                  value={confirmPassword}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleUpdatePassword();
                  }}
                />
              </div>

              <Button
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
              >
                {isUpdatingPassword ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Actualizando
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Guardar nueva contraseña
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="auth-email" className="text-xs font-bold uppercase tracking-wider">
                  Correo de acceso
                </Label>
                <Input
                  id="auth-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handlePasswordSignIn();
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="auth-password"
                  className="text-xs font-bold uppercase tracking-wider"
                >
                  Contraseña
                </Label>
                <Input
                  id="auth-password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handlePasswordSignIn();
                  }}
                />
              </div>

              <Button
                className="w-full bg-slate-900 text-white hover:bg-slate-800"
                onClick={handlePasswordSignIn}
                disabled={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Entrando
                  </>
                ) : (
                  <>
                    <KeyRound className="mr-2 h-4 w-4" />
                    Entrar con contraseña
                  </>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={handleSendRecoveryEmail}
                disabled={isSendingRecovery || isSigningIn}
              >
                {isSendingRecovery ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando recuperación
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Recuperar contraseña
                  </>
                )}
              </Button>
            </>
          )}
        </div>

        <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
          {isRecoveryMode
            ? "Después de guardar la nueva contraseña podrás seguir usando la app en este navegador."
            : "La sesión quedará guardada en este navegador. Usa recuperación solo si necesitas cambiar la contraseña."}
        </p>
      </div>
    </div>
  );
}
