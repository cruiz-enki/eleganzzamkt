import { useState } from "react";
import { Check, Copy, Info, Palette, Quote, Ruler, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import {
  COLORES,
  COMPONENTES,
  DIRECCION_VISUAL,
  ESENCIA,
  FUNDAMENTOS,
  PENDIENTES,
  PERSONALIDAD,
  TAGLINE,
  TIPOGRAFIA,
  VOZ,
  type Color,
} from "@/lib/domain/brand-system";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// El logotipo del design system, servido por la propia app. La URL anterior
// (Supabase Storage) responde 400: la sección llevaba tiempo mostrando el
// marcador de posición en vez del logo.
const LOGO_URL = "/eleganzza-logo.png";

function Muestra({ color }: { color: Color }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(color.hex);
    setCopiado(true);
    toast.success(`${color.hex} copiado`);
    setTimeout(() => setCopiado(false), 1500);
  };

  return (
    <button
      type="button"
      onClick={copiar}
      className="group flex items-center gap-3 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-colors text-left w-full"
    >
      <span
        className="h-11 w-11 rounded-md shadow-sm shrink-0 border border-black/5"
        style={{ backgroundColor: color.hex }}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
          {color.nombre}
        </span>
        <span className="block text-xs font-mono text-slate-500">{color.hex}</span>
        {color.uso && (
          <span className="block text-[11px] text-slate-400 truncate">{color.uso}</span>
        )}
      </span>
      {copiado ? (
        <Check className="h-4 w-4 text-emerald-500 shrink-0" />
      ) : (
        <Copy className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </button>
  );
}

export function BrandPanel() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row gap-8 md:items-center">
        <div className="md:w-64 shrink-0">
          <div className="aspect-video bg-[#fdfbf7] rounded-xl flex items-center justify-center p-6 border border-[#e2cfb4]">
            <img
              src={LOGO_URL}
              alt="Eleganzza Muebles"
              className="max-h-full object-contain"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                if (!target.src.includes("placehold")) {
                  target.src = "https://placehold.co/600x400/c73a2a/FFFFFF?text=Eleganzza";
                }
              }}
            />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#c73a2a]">
            {TAGLINE}
          </p>
          <p className="text-lg text-slate-700 dark:text-slate-200 leading-relaxed">{ESENCIA}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{DIRECCION_VISUAL}</p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {PERSONALIDAD.map((rasgo) => (
              <Badge
                key={rasgo}
                variant="secondary"
                className="bg-[#f8f1e7] text-[#6e1508] border-0 font-normal"
              >
                {rasgo}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="color">
        <TabsList>
          <TabsTrigger value="color">
            <Palette className="h-3.5 w-3.5 mr-1.5" />
            Color
          </TabsTrigger>
          <TabsTrigger value="tipografia">
            <TypeIcon className="h-3.5 w-3.5 mr-1.5" />
            Tipografía
          </TabsTrigger>
          <TabsTrigger value="voz">
            <Quote className="h-3.5 w-3.5 mr-1.5" />
            Voz
          </TabsTrigger>
          <TabsTrigger value="fundamentos">
            <Ruler className="h-3.5 w-3.5 mr-1.5" />
            Fundamentos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="color" className="space-y-8 pt-4">
          <p className="text-xs text-slate-400">Haz clic en un color para copiar su código.</p>
          {COLORES.map((grupo) => (
            <section key={grupo.titulo} className="space-y-3">
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {grupo.titulo}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
                  {grupo.descripcion}
                </p>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {grupo.colores.map((color) => (
                  <Muestra key={color.variable + color.hex} color={color} />
                ))}
              </div>
            </section>
          ))}
        </TabsContent>

        <TabsContent value="tipografia" className="space-y-8 pt-4">
          {[TIPOGRAFIA.display, TIPOGRAFIA.cuerpo].map((fuente) => (
            <section
              key={fuente.familia}
              className="space-y-2 pb-6 border-b border-slate-100 dark:border-slate-800 last:border-0"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {fuente.familia}
                </h4>
                <span className="text-xs text-slate-400">{fuente.uso}</span>
              </div>
              <p
                className="text-slate-800 dark:text-slate-100"
                style={{
                  fontFamily: fuente.css,
                  fontSize: fuente === TIPOGRAFIA.display ? 38 : 18,
                  lineHeight: 1.3,
                }}
              >
                {fuente.muestra}
              </p>
            </section>
          ))}

          <section className="space-y-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Escala</h4>
            <div className="flex flex-wrap gap-2">
              {TIPOGRAFIA.escala.map((paso) => (
                <span
                  key={paso.nombre}
                  className="px-2.5 py-1 rounded-md bg-slate-50 dark:bg-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300"
                >
                  {paso.nombre} · {paso.px}px
                </span>
              ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="voz" className="space-y-4 pt-4">
          {VOZ.map((regla) => (
            <div
              key={regla.titulo}
              className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {regla.titulo}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{regla.detalle}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="fundamentos" className="space-y-4 pt-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {FUNDAMENTOS.map((f) => (
              <div
                key={f.titulo}
                className="p-4 rounded-xl border border-slate-100 dark:border-slate-800"
              >
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {f.titulo}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{f.detalle}</p>
              </div>
            ))}
          </div>

          <section className="pt-2">
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-2">
              Componentes definidos
            </h4>
            <div className="grid sm:grid-cols-2 gap-2">
              {COMPONENTES.map((c) => (
                <div key={c.grupo} className="text-xs text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {c.grupo}:
                  </span>{" "}
                  {c.piezas.join(", ")}
                </div>
              ))}
            </div>
          </section>
        </TabsContent>
      </Tabs>

      <div
        className={cn(
          "flex gap-3 p-4 rounded-xl",
          "bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30",
        )}
      >
        <Info className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
          <p className="font-semibold">Pendientes de confirmar con Eleganzza</p>
          {PENDIENTES.map((p) => (
            <p key={p}>· {p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
