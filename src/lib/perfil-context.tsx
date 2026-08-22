import { createContext, useContext } from "react";
import { permisos, type Perfil } from "@/lib/api/usuarios";

/**
 * El perfil de quien está usando la app, disponible en todo el árbol.
 * Lo provee AuthGate, que es quien ya sabe si hay sesión válida.
 *
 * Sirve para ESCONDER lo que no aplica a cada rol. Lo que impide de verdad que
 * alguien haga algo son las reglas de la base (RLS), no esto.
 */

export type PerfilContexto = {
  perfil: Perfil | null;
  permisos: ReturnType<typeof permisos>;
};

const Contexto = createContext<PerfilContexto>({
  perfil: null,
  permisos: permisos(null),
});

export const PerfilProvider = Contexto.Provider;

export function usePerfil(): PerfilContexto {
  return useContext(Contexto);
}
