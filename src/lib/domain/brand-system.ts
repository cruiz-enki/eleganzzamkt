/**
 * Design System de Eleganzza Muebles.
 *
 * Los valores vienen del paquete "Eleganzza Design System" (tokens/, guidelines/).
 * Se guardan como DATOS y no como texto suelto en el JSX para poder reutilizarlos
 * después: prompts de IA, plantillas de publicaciones, exportaciones para diseño.
 *
 * Nota importante que viene del propio sistema: la paleta y las tipografías se
 * DEDUJERON del logotipo y de la personalidad de marca, no de un manual oficial.
 * Si Eleganzza entrega su manual o sus fuentes reales, esto debe reconciliarse.
 */

export type Color = {
  nombre: string;
  variable: string;
  hex: string;
  uso?: string;
};

export type GrupoDeColor = {
  titulo: string;
  descripcion: string;
  colores: Color[];
};

export const ESENCIA =
  "Elegancia, calidad, confort y atención cercana para transformar espacios cotidianos en hogares que se disfrutan.";

export const TAGLINE = "Elegancia · Calidad y Confort";

export const PERSONALIDAD = [
  "Elegante",
  "Cálida",
  "Familiar",
  "Confiable",
  "Aspiracional pero accesible",
  "Moderna",
  "Cercana",
  "Orientada al confort",
];

export const DIRECCION_VISUAL =
  "Editorial de mueble contemporáneo con calidez de hogar mexicano: premium y sofisticado, sin volverse frío, minimalista ni intimidante.";

export const COLORES: GrupoDeColor[] = [
  {
    titulo: "Marca",
    descripcion:
      "El rojo vino sale del propio logotipo. Es el único acento de marca: se usa en botones principales, ligas y detalles, nunca como fondo de secciones grandes.",
    colores: [
      {
        nombre: "Rojo Eleganzza",
        variable: "--brand-primary",
        hex: "#c73a2a",
        uso: "Botón principal, ligas",
      },
      {
        nombre: "Vino (hover)",
        variable: "--brand-primary-hover",
        hex: "#6e1508",
        uso: "Hover del botón principal",
      },
      {
        nombre: "Vino profundo",
        variable: "--color-maroon-900",
        hex: "#3f0d06",
        uso: "Estado presionado",
      },
      { nombre: "Rojo claro", variable: "--color-red-400", hex: "#e8705d" },
      {
        nombre: "Rosa pálido",
        variable: "--color-blush-200",
        hex: "#f5b8ae",
        uso: "Anillo de foco en campos",
      },
      { nombre: "Rosa muy claro", variable: "--color-blush-100", hex: "#fbe2dd" },
    ],
  },
  {
    titulo: "Neutros cálidos",
    descripcion:
      "El sistema se apoya en cremas y arenas, no en blancos y grises. Esto es lo que hace que se sienta hogar y no aplicación.",
    colores: [
      { nombre: "Crema (fondo)", variable: "--bg-page", hex: "#fdfbf7", uso: "Fondo de página" },
      {
        nombre: "Crema 100",
        variable: "--color-cream-100",
        hex: "#f8f1e7",
        uso: "Superficie alterna",
      },
      { nombre: "Arena 200", variable: "--bg-sunken", hex: "#efe2d1", uso: "Zonas hundidas" },
      { nombre: "Arena 300", variable: "--border-subtle", hex: "#e2cfb4", uso: "Bordes suaves" },
      {
        nombre: "Taupe 400",
        variable: "--border-strong",
        hex: "#b39d86",
        uso: "Bordes de énfasis",
      },
      {
        nombre: "Taupe 500",
        variable: "--text-secondary",
        hex: "#8a7361",
        uso: "Texto secundario",
      },
      { nombre: "Café 700", variable: "--color-espresso-700", hex: "#4a3428" },
      { nombre: "Café 900", variable: "--text-primary", hex: "#2a1c14", uso: "Texto principal" },
    ],
  },
  {
    titulo: "Acento metálico",
    descripcion:
      "Un latón apagado que remite a los herrajes del mueble: patas, jaladeras. Se usa con cuentagotas, para detalles y focos.",
    colores: [
      { nombre: "Oro 400", variable: "--brand-secondary", hex: "#c9a25f" },
      { nombre: "Oro 600", variable: "--focus-ring", hex: "#a67c3d", uso: "Anillo de foco" },
    ],
  },
  {
    titulo: "Semánticos",
    descripcion: "Solo para estados del sistema: confirmaciones, avisos, errores e información.",
    colores: [
      { nombre: "Éxito", variable: "--color-success-600", hex: "#4d7a52" },
      { nombre: "Éxito claro", variable: "--color-success-100", hex: "#e3ecdf" },
      { nombre: "Aviso", variable: "--color-warning-600", hex: "#b9822c" },
      { nombre: "Aviso claro", variable: "--color-warning-100", hex: "#f7ead2" },
      { nombre: "Error", variable: "--color-danger-600", hex: "#b3261e" },
      { nombre: "Error claro", variable: "--color-danger-100", hex: "#f6dedc" },
      { nombre: "Información", variable: "--color-info-600", hex: "#5c6f7a" },
      { nombre: "Información clara", variable: "--color-info-100", hex: "#e6ebed" },
    ],
  },
];

export const TIPOGRAFIA = {
  display: {
    familia: "Playfair Display",
    css: "'Playfair Display', Georgia, serif",
    uso: "Títulos, nombres de producto y precios cuando son protagonistas.",
    muestra: "Sala Boston",
  },
  cuerpo: {
    familia: "Nunito Sans",
    css: "'Nunito Sans', -apple-system, 'Segoe UI', sans-serif",
    uso: "Todo el texto de interfaz, descripciones y copys.",
    muestra:
      "Piel genuina color terracota, base de madera maciza y patas doradas. Hecho para durar generaciones.",
  },
  escala: [
    { nombre: "xs", px: 12 },
    { nombre: "sm", px: 14 },
    { nombre: "base", px: 16 },
    { nombre: "lg", px: 18 },
    { nombre: "xl", px: 20 },
    { nombre: "2xl", px: 24 },
    { nombre: "3xl", px: 30 },
    { nombre: "4xl", px: 38 },
    { nombre: "5xl", px: 48 },
    { nombre: "6xl", px: 60 },
  ],
};

export const VOZ = [
  {
    titulo: "Idioma y trato",
    detalle:
      "Español de México, de tú. Cálido y personal, nunca corporativo: «Muebles que se disfrutan», no «disfrutados por el cliente».",
  },
  {
    titulo: "Tono",
    detalle:
      "Invitante y un poco aspiracional. Frases cortas y sensoriales antes que listas de características.",
  },
  {
    titulo: "Mayúsculas",
    detalle:
      "Tipo oración en textos y botones («Agregar al carrito», no «AGREGAR AL CARRITO»). Las mayúsculas se reservan para etiquetas pequeñas: NUEVO, SALA.",
  },
  {
    titulo: "Emojis",
    detalle: "No se usan. La voz es editorial, de impreso, no de red social.",
  },
  {
    titulo: "Precios",
    detalle: "Siempre como $X,XXX en pesos, sin decimales cuando son pesos cerrados.",
  },
];

export const FUNDAMENTOS = [
  {
    titulo: "Espaciado",
    detalle: "Escala de 4 px: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128.",
  },
  {
    titulo: "Esquinas",
    detalle:
      "10 px en campos y tarjetas, 16 px en superficies grandes y diálogos. Totalmente redondo solo en botones, insignias y chips.",
  },
  {
    titulo: "Sombras",
    detalle:
      "Suaves y de tinte café, nunca negro puro. Las tarjetas son blancas con sombra suave, o con borde arena y sin sombra en listados densos.",
  },
  {
    titulo: "Bordes",
    detalle:
      "Delgados (1 a 1.5 px), color arena para estructura y taupe para énfasis. Nunca negros.",
  },
  {
    titulo: "Fotografía",
    detalle:
      "Ambientes y producto en tonos cálidos: terracota, madera, latón. Nada en frío ni blanco y negro.",
  },
  {
    titulo: "Movimiento",
    detalle:
      "Mínimo y funcional: transiciones cortas al pasar el cursor o enfocar (120 a 340 ms). Sin rebotes ni animación decorativa.",
  },
  {
    titulo: "Íconos",
    detalle:
      "Lucide, de 18 a 20 px, usados con moderación y solo cuando aportan (carrito, buscar, cerrar). Sin emojis.",
  },
];

export const COMPONENTES = [
  { grupo: "Base", piezas: ["Button", "IconButton"] },
  { grupo: "Formularios", piezas: ["Input", "Select", "Checkbox", "Radio", "Switch"] },
  { grupo: "Retroalimentación", piezas: ["Badge", "Tag", "Toast", "Tooltip"] },
  { grupo: "Superficies", piezas: ["Card", "Tabs", "Dialog"] },
];

/** Lo que el propio sistema deja marcado como pendiente de confirmar. */
export const PENDIENTES = [
  "La paleta se dedujo de los colores del logotipo, no de un manual de marca. Si existe el manual, hay que reconciliarlo.",
  "Playfair Display y Nunito Sans son sustitutos de Google Fonts elegidos por afinidad. Si Eleganzza tiene fuentes propias, se cambian.",
  "El juego de íconos es Lucide por defecto; si hay uno propio, se reemplaza.",
];
