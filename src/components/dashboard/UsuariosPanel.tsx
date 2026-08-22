import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, KeyRound, Loader2, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import {
  getPerfiles,
  getAccessToken,
  ROL_LABEL,
  ROL_DESCRIPCION,
  type Perfil,
  type Rol,
} from "@/lib/api/usuarios";
import {
  crearUsuario,
  actualizarUsuario,
  reiniciarPassword,
  eliminarUsuario,
} from "@/lib/api/usuarios.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const ROLES: Rol[] = ["admin", "editor", "lector"];

const ROL_ESTILO: Record<Rol, string> = {
  admin: "bg-[#1B3566] text-white",
  editor: "bg-[#00B5C8]/15 text-[#00838f]",
  lector: "bg-slate-100 text-slate-600",
};

/** La contraseña temporal se muestra una sola vez: aquí se copia. */
function PasswordUnaVez({ email, password }: { email: string; password: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <div className="rounded-xl border border-[#00B5C8]/40 bg-[#00B5C8]/5 p-4 space-y-2">
      <p className="text-sm font-semibold text-slate-800">Cuenta creada para {email}</p>
      <p className="text-xs text-slate-500">
        Esta contraseña temporal se muestra <strong>una sola vez</strong>. Cópiala y compártela;
        después ya no se puede consultar, solo generar una nueva.
      </p>
      <div className="flex gap-2">
        <code className="flex-1 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm font-mono">
          {password}
        </code>
        <Button
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopiado(true);
            toast.success("Contraseña copiada");
          }}
        >
          {copiado ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export function UsuariosPanel({ miId }: { miId: string | null }) {
  const queryClient = useQueryClient();
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [email, setEmail] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState<Rol>("editor");
  const [credencial, setCredencial] = useState<{ email: string; password: string } | null>(null);

  const { data: perfiles = [], isLoading } = useQuery({
    queryKey: ["perfiles"],
    queryFn: getPerfiles,
  });

  const refrescar = () => queryClient.invalidateQueries({ queryKey: ["perfiles"] });

  const crear = useMutation({
    mutationFn: async () =>
      crearUsuario({
        data: {
          accessToken: await getAccessToken(),
          email: email.trim(),
          nombre: nombre.trim(),
          rol,
        },
      }),
    onSuccess: async (res) => {
      setCredencial(res);
      setEmail("");
      setNombre("");
      setRol("editor");
      setNuevoAbierto(false);
      await refrescar();
      toast.success("Cuenta creada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo crear"),
  });

  const actualizar = useMutation({
    mutationFn: async (input: { id: string; rol?: Rol; activo?: boolean }) =>
      actualizarUsuario({ data: { accessToken: await getAccessToken(), ...input } }),
    onSuccess: async () => {
      await refrescar();
      toast.success("Usuario actualizado");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo actualizar"),
  });

  const reiniciar = useMutation({
    mutationFn: async (perfil: Perfil) => {
      const res = await reiniciarPassword({
        data: { accessToken: await getAccessToken(), id: perfil.id },
      });
      return { email: perfil.email, password: res.password };
    },
    onSuccess: (res) => {
      setCredencial(res);
      toast.success("Contraseña nueva generada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo reiniciar"),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) =>
      eliminarUsuario({ data: { accessToken: await getAccessToken(), id } }),
    onSuccess: async () => {
      await refrescar();
      toast.success("Cuenta eliminada");
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "No se pudo eliminar"),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-[#1B3566] dark:text-[#00B5C8]" />
            Usuarios
          </h2>
          <p className="text-sm text-slate-500">
            Quién entra a la plataforma y qué puede hacer cada quien.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 bg-[#1B3566] text-white hover:bg-[#132a52]"
          onClick={() => setNuevoAbierto(true)}
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Nuevo usuario
        </Button>
      </div>

      {credencial && (
        <PasswordUnaVez email={credencial.email} password={credencial.password} />
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {ROLES.map((r) => (
          <div
            key={r}
            className="rounded-xl border border-slate-100 dark:border-slate-800 p-3 text-xs"
          >
            <Badge className={cn("border-0 mb-1", ROL_ESTILO[r])}>{ROL_LABEL[r]}</Badge>
            <p className="text-slate-500 dark:text-slate-400">{ROL_DESCRIPCION[r]}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-100 dark:border-slate-800 divide-y divide-slate-50 dark:divide-slate-800">
          {perfiles.map((p) => {
            const soyYo = p.id === miId;
            return (
              <div key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    {p.nombre || p.email.split("@")[0]}
                    {soyYo && <span className="text-xs text-slate-400 font-normal"> · tú</span>}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{p.email}</p>
                </div>

                {!p.activo && (
                  <Badge className="bg-slate-100 text-slate-500 border-0 text-[10px]">
                    Sin acceso
                  </Badge>
                )}

                <select
                  value={p.rol}
                  disabled={soyYo || actualizar.isPending}
                  onChange={(e) => actualizar.mutate({ id: p.id, rol: e.target.value as Rol })}
                  className="h-8 px-2 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-xs disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROL_LABEL[r]}
                    </option>
                  ))}
                </select>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-slate-500"
                  disabled={reiniciar.isPending}
                  onClick={() => reiniciar.mutate(p)}
                >
                  <KeyRound className="h-3.5 w-3.5 mr-1" />
                  Contraseña
                </Button>

                {!soyYo && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs text-slate-500"
                      disabled={actualizar.isPending}
                      onClick={() => actualizar.mutate({ id: p.id, activo: !p.activo })}
                    >
                      {p.activo ? "Quitar acceso" : "Dar acceso"}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-red-600 hover:bg-red-50"
                      disabled={eliminar.isPending}
                      onClick={() => {
                        if (confirm(`¿Eliminar la cuenta de ${p.email}? No se puede deshacer.`))
                          eliminar.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={nuevoAbierto} onOpenChange={setNuevoAbierto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo usuario</DialogTitle>
            <DialogDescription>
              Se crea la cuenta y se genera una contraseña temporal que tú le compartes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="email-nuevo">Correo</Label>
              <Input
                id="email-nuevo"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="persona@enkisoluciones.mx"
              />
            </div>
            <div>
              <Label htmlFor="nombre-nuevo">Nombre</Label>
              <Input
                id="nombre-nuevo"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Cómo se llama"
              />
            </div>
            <div>
              <Label htmlFor="rol-nuevo">Rol</Label>
              <select
                id="rol-nuevo"
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
                className="w-full h-10 px-3 rounded-md border border-slate-200 dark:border-slate-700 bg-transparent text-sm"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]} — {ROL_DESCRIPCION[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setNuevoAbierto(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-[#1B3566] text-white hover:bg-[#132a52]"
              disabled={!email.includes("@") || crear.isPending}
              onClick={() => crear.mutate()}
            >
              {crear.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear cuenta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
