/**
 * Cruce entre las listas de precios de proveedor y los muebles del catálogo.
 *
 * El problema real: en la plataforma los muebles se llaman solo por su modelo
 * ("MONTREAL", "milán") y en las listas viene el tipo por delante ("SILLÓN
 * MONTREAL", "MESA MILÁN 2.40"). Coincidir por modelo a secas es peligroso:
 * "MONTREAL" está capturado como CAMAS y en las listas hay un SILLÓN Montreal.
 * Por eso, además del modelo, se compara el TIPO contra la categoría.
 */

/** Palabras que describen el tipo de mueble, no el modelo. */
const TIPOS = [
  "SALA",
  "MODULAR",
  "ESCUADRA",
  "SILLON",
  "LOVE",
  "MESA",
  "COMEDOR",
  "SILLA",
  "RECAMARA",
  "CAMA",
  "CABECERA",
  "BURO",
  "COMODA",
  "TOCADOR",
  "CAJON",
  "CANTINA",
  "LIBRERO",
  "CENTRO",
  "COLCHON",
  "EDREDON",
  "CUBRECAMA",
  "SABANA",
  "ALMOHADA",
  "VITRINA",
  "TRINCHADOR",
  "ESPEJO",
] as const;

/** Qué tipos son aceptables para cada categoría del catálogo. */
const CATEGORIA_TIPOS: Record<string, string[]> = {
  SALAS: ["SALA", "MODULAR", "ESCUADRA", "SILLON", "LOVE"],
  SALA: ["SALA", "MODULAR", "ESCUADRA", "SILLON", "LOVE"],
  COMEDORES: ["MESA", "COMEDOR", "SILLA", "VITRINA", "TRINCHADOR"],
  "COMEDORES CONTEMPORANEOS": ["MESA", "COMEDOR", "SILLA", "VITRINA", "TRINCHADOR"],
  "COMEDORES CONTEMPORANEOS2": ["MESA", "COMEDOR", "SILLA", "VITRINA", "TRINCHADOR"],
  RECAMARA: ["RECAMARA", "CAMA", "CABECERA", "BURO", "COMODA", "TOCADOR", "CAJON"],
  RECAMARAS: ["RECAMARA", "CAMA", "CABECERA", "BURO", "COMODA", "TOCADOR", "CAJON"],
  CAMAS: ["CAMA", "RECAMARA", "CABECERA", "COLCHON"],
  CAMA: ["CAMA", "RECAMARA", "CABECERA", "COLCHON"],
  CUBRECAMAS: ["CUBRECAMA", "EDREDON", "SABANA"],
  "SET DE CUBRECAMA": ["CUBRECAMA", "EDREDON", "SABANA"],
  EDREDON: ["EDREDON", "CUBRECAMA"],
  FRAZADA: ["EDREDON", "CUBRECAMA"],
};

/** Palabras que no distinguen un modelo de otro. */
const STOP = new Set(
  (
    "SALA SALAS RECAMARA RECAMARAS COMEDOR COMEDORES CAMA CAMAS CABECERA BURO COMODA CAJON " +
    "MESA SILLA SILLAS JUEGO SET DE CON Y EL LA DEL LOS LAS PZ PZS PIEZAS MODULAR ESCUADRA " +
    "INDIVIDUAL MATRIMONIAL QUEEN KING SIZE QS KS MTS CM MM ESPEJO PIE TOCADOR LUNA CANTINA " +
    "MUEBLE TV CENTRAL CENTRO COLCHON EDREDON CUBRECAMA SILLON LOVE SEAT LIBRERO VITRINA " +
    "TRINCHADOR NOGAL CASTANO BLANCO NEGRO CHOCOLATE UV PARA"
  ).split(" "),
);

export function normalizar(valor: unknown): string {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // acentos
    .replace(/[^A-Za-z0-9 ]/g, " ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Las palabras que identifican al modelo (sin tipos ni medidas). */
export function tokensDeModelo(nombre: unknown): Set<string> {
  return new Set(
    normalizar(nombre)
      .split(" ")
      .filter((t) => t.length > 2 && !STOP.has(t) && !/^\d+$/.test(t)),
  );
}

export function tiposEn(nombre: unknown): string[] {
  const n = normalizar(nombre);
  return TIPOS.filter((t) => new RegExp(`\\b${t}`).test(n));
}

/** ¿El tipo que dice la lista cabe en la categoría del mueble? */
export function categoriaCompatible(categoria: unknown, nombreEnLista: unknown): boolean | null {
  const permitidos = CATEGORIA_TIPOS[normalizar(categoria)];
  if (!permitidos) return null; // categoría demasiado vaga para opinar
  const tipos = tiposEn(nombreEnLista);
  if (tipos.length === 0) return null; // la lista no dice el tipo
  return tipos.some((t) => permitidos.includes(t));
}

export type FilaDeLista = {
  nombre: string;
  precio: number;
  proveedor?: string;
};

export type Candidato = FilaDeLista & {
  /** true = el tipo cuadra con la categoría; false = no cuadra; null = no se puede saber */
  compatible: boolean | null;
};

export type MuebleParaCruce = {
  id: string;
  nombre: string;
  categoria: string | null;
  precio: number | null;
};

export type Cruce = {
  mueble: MuebleParaCruce;
  candidatos: Candidato[];
  /** Confiable = un solo candidato y el tipo cuadra con la categoría. */
  confiable: boolean;
};

/**
 * Para cada mueble, busca en la lista las filas cuyo modelo coincide.
 * Un modelo "coincide" cuando un conjunto de palabras contiene al otro:
 * "MILAN" ⊆ "MESA MILAN 2.40". Los incompatibles por tipo se descartan.
 */
export function cruzarPrecios(muebles: MuebleParaCruce[], filas: FilaDeLista[]): Cruce[] {
  const filasConTokens = filas
    .map((f) => ({ fila: f, tokens: tokensDeModelo(f.nombre) }))
    .filter((f) => f.tokens.size > 0);

  const cruces: Cruce[] = [];

  for (const mueble of muebles) {
    const tokens = tokensDeModelo(mueble.nombre);
    if (tokens.size === 0) continue;

    const candidatos: Candidato[] = [];
    for (const { fila, tokens: ft } of filasConTokens) {
      const contieneA = [...tokens].every((t) => ft.has(t));
      const contieneB = [...ft].every((t) => tokens.has(t));
      if (!contieneA && !contieneB) continue;

      const compatible = categoriaCompatible(mueble.categoria, fila.nombre);
      if (compatible === false) continue; // el tipo contradice la categoría
      candidatos.push({ ...fila, compatible });
    }

    if (candidatos.length === 0) continue;

    // Primero los que sí cuadran por tipo, luego por precio descendente.
    candidatos.sort((a, b) => {
      if (a.compatible !== b.compatible) return a.compatible === true ? -1 : 1;
      return b.precio - a.precio;
    });

    cruces.push({
      mueble,
      candidatos,
      confiable: candidatos.length === 1 && candidatos[0]?.compatible === true,
    });
  }

  return cruces;
}
