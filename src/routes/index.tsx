import { createFileRoute } from "@tanstack/react-router";
import { BentoGrid, BentoItem } from "@/components/dashboard/BentoGrid";
import { 
  LayoutDashboard, 
  Database, 
  Cloud, 
  Sparkles, 
  Image as ImageIcon, 
  TrendingUp,
  Table as TableIcon,
  Package,
  Megaphone,
  Palette,
  Settings,
  Menu,
  X,
  Sparkles as SparklesIcon,
  Loader2,
  Moon,
  Sun
} from "lucide-react";
import { AirtableInventory } from "@/components/dashboard/AirtableInventory";
import { SupabaseInventory } from "@/components/dashboard/SupabaseInventory";
import { Suspense, useState, useEffect } from "react";
import { IAGenerator } from "@/components/dashboard/IAGenerator";
import { PromptSettings } from "@/components/dashboard/PromptSettings";
import { CampaignsManager } from "@/components/dashboard/CampaignsManager";
import { CatalogosManager } from "@/components/dashboard/CatalogosManager";
import { generateMarketingCopy, cleanProductImage } from "@/lib/api/ai.functions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BookOpen } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eleganzza Marketing | Inventario" },
      { name: "description", content: "Centro de operaciones e inventario de Eleganzza Muebles." },
      { property: "og:title", content: "Eleganzza Marketing | Inventario" },
      { property: "og:description", content: "Centro de operaciones e inventario de Eleganzza Muebles." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type ViewType = "dashboard" | "productos" | "campañas" | "catalogos" | "marca" | "configuracion" | "ia-generator";

function Index() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDarkMode]);

  const handleGenerateCopy = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Por favor ingresa un tema para el copy.");
      return;
    }
    
    setIsGenerating(true);
    try {
      const copy = await generateMarketingCopy({ data: { prompt: aiPrompt } });
      setAiResult(copy);
      toast.success("Copy generado con éxito");
    } catch (error) {
      console.error("AI Generation error:", error);
      toast.error("Error al generar contenido. Verifica tu conexión.");
    } finally {
      setIsGenerating(false);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "productos", label: "Productos", icon: Package },
    { id: "campañas", label: "Campañas", icon: Megaphone },
    { id: "catalogos", label: "Catálogos", icon: BookOpen },
    { id: "marca", label: "Marca", icon: Palette },
    { id: "ia-generator", label: "IA Generator", icon: SparklesIcon },
    { id: "configuracion", label: "Configuración", icon: Settings },
  ] as const;


  return (
    <div className="min-h-screen bg-[#fcfbf8] dark:bg-slate-950 flex transition-colors duration-300">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out lg:static lg:block",
          isSidebarOpen ? "w-64" : "w-20",
          !isSidebarOpen && "lg:w-20"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            {isSidebarOpen ? (
              <h2 className="text-xl font-serif font-bold text-slate-900 dark:text-white truncate">Eleganzza</h2>
            ) : (
              <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center mx-auto">
                <span className="text-white dark:text-slate-900 font-serif font-bold">E</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex dark:text-slate-400 dark:hover:text-white"
            >
              {isSidebarOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </Button>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors group",
                  view === item.id 
                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900" 
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0",
                  view === item.id 
                    ? "text-white dark:text-slate-900" 
                    : "text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white"
                )} />
                {isSidebarOpen && <span className="font-medium text-left">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "w-full justify-start gap-3 px-3 dark:text-slate-400 dark:hover:text-white",
                !isSidebarOpen && "justify-center px-0"
              )}
              onClick={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {isSidebarOpen && <span>{isDarkMode ? "Modo Claro" : "Modo Oscuro"}</span>}
            </Button>

            {isSidebarOpen ? (
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
                <p className="text-xs text-slate-400 uppercase font-bold">Marketing Team</p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mt-1">Admin Panel</p>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 mx-auto" />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-slate-900 dark:text-white tracking-tight capitalize">
                {view === "dashboard" ? "Resumen de Operaciones" : view}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">Eleganzza Marketing Hub</p>
            </div>
          </header>

          {view === "dashboard" && (
            <BentoGrid>
              {/* Sección Principal - Status */}
              <BentoItem 
                title="Resumen de Marca" 
                className="md:col-span-2 md:row-span-2 flex flex-col justify-between"
                icon={<LayoutDashboard className="h-4 w-4 text-slate-400" />}
              >
                <div className="mt-4">
                  <h2 className="text-2xl font-semibold text-slate-800 dark:text-white">Elegannza Muebles</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                    Gestión centralizada de campañas, activos digitales y base de datos estratégica.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold">Activos</p>
                      <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">1,240</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-400 dark:text-slate-500 uppercase font-bold">Leads</p>
                      <p className="text-xl font-semibold text-slate-700 dark:text-slate-200">856</p>
                    </div>
                  </div>
                </div>
              </BentoItem>

              {/* Conectividad Google Drive */}
              <BentoItem 
                title="Google Drive" 
                className="md:col-span-2"
                icon={<Cloud className="h-4 w-4 text-slate-400" />}
              >
                <div className="flex items-center gap-3 mt-2">
                  <div className="h-10 w-10 rounded bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Unidad Compartida</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Conexión establecida</p>
                  </div>
                </div>
              </BentoItem>

              {/* Airtable Preview (Vista rápida) */}
              <BentoItem 
                title="Inventario (Vista Rápida)" 
                className="md:col-span-2"
                icon={<TableIcon className="h-4 w-4 text-slate-400" />}
              >
                <div className="mt-2">
                  <p className="text-2xl font-semibold text-slate-700 dark:text-slate-200">Catálogo</p>
                  <button 
                    onClick={() => setView("productos")}
                    className="text-xs text-blue-500 font-bold uppercase mt-2 hover:underline"
                  >
                    Ver todo el contenido →
                  </button>
                </div>
              </BentoItem>

              {/* OpenAI Assist */}
              <BentoItem 
                title="AI Creative Lab" 
                className="md:col-span-2 md:row-span-2"
                icon={<Sparkles className="h-4 w-4 text-indigo-400" />}
              >
                <div className="mt-4 space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400">Genera copys de marketing al instante con GPT-4o.</p>
                  <textarea 
                    className="w-full p-2 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none resize-none"
                    placeholder="Ej: Sofá de terciopelo azul para sala moderna..."
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  {aiResult && (
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg text-[10px] text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto">
                      {aiResult}
                    </div>
                  )}
                  <button 
                    onClick={handleGenerateCopy}
                    disabled={isGenerating}
                    className="w-full py-2 bg-indigo-500 text-white text-xs font-bold rounded hover:bg-indigo-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isGenerating ? "GENERANDO..." : "GENERAR COPY"}
                  </button>
                </div>
              </BentoItem>

              {/* Métricas rápidas */}
              <BentoItem 
                title="Rendimiento" 
                className="md:col-span-2"
                icon={<TrendingUp className="h-4 w-4 text-emerald-400" />}
              >
                <div className="mt-2">
                  <p className="text-3xl font-serif text-slate-800 dark:text-white">+12.4%</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">vs mes anterior</p>
                </div>
              </BentoItem>

              {/* Supabase Status */}
              <BentoItem 
                title="Backend" 
                className="md:col-span-2"
                icon={<Database className="h-4 w-4 text-slate-400" />}
              >
                <div className="mt-2 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Supabase Propio</p>
                    <p className="text-xs text-emerald-500 dark:text-emerald-400 font-bold uppercase tracking-tighter">Online</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </BentoItem>
            </BentoGrid>
          )}

          {view === "productos" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-slate-400" />
                    Inventario de Productos
                  </h2>
                  <p className="text-sm text-slate-500">Visualizando datos directamente desde Supabase.</p>
                </div>
              </div>
              <Suspense fallback={<div className="space-y-2"><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/><Skeleton className="h-8 w-full"/></div>}>
                <SupabaseInventory />
              </Suspense>
            </div>
          )}

          {view === "ia-generator" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <SparklesIcon className="h-5 w-5 text-indigo-400" />
                    IA Generator Creative Lab
                  </h2>
                  <p className="text-sm text-slate-500">Crea contenido publicitario vinculado a tus productos de Eleganzza.</p>
                </div>
              </div>
              <Suspense fallback={<div className="space-y-4"><Skeleton className="h-40 w-full"/><Skeleton className="h-60 w-full"/></div>}>
                <IAGenerator />
              </Suspense>
            </div>
          )}

          {view === "configuracion" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
              <PromptSettings />
            </div>
          )}

          {view === "campañas" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>}>
                <CampaignsManager />
              </Suspense>
            </div>
          )}

          {view === "catalogos" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <Suspense fallback={<div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>}>
                <CatalogosManager />
              </Suspense>
            </div>
          )}

          {view === "marca" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm min-h-[600px]">
              <div className="max-w-4xl mx-auto space-y-12">
                <section>
                  <h3 className="text-2xl font-serif font-semibold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <Palette className="h-6 w-6 text-red-600" />
                    Identidad Visual
                  </h3>
                  
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Logotipo Principal</p>
                      <div className="aspect-video bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center p-8 border border-slate-200 dark:border-slate-700 shadow-inner group relative overflow-hidden">
                        <img 
                          src="https://eqshiiiekxbpsdilckuv.supabase.co/storage/v1/object/public/muebles/eleganzzacolor.png" 
                          alt="Eleganzza Logo" 
                          className="max-h-full object-contain relative z-10"
                          onError={(e) => {
                            // Intento de fallback si la URL de Supabase falla
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes('placeholder')) {
                              target.src = "https://placehold.co/600x400/000000/FFFFFF?text=Eleganzza+Muebles";
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Paleta de Colores</p>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-[#A31D1D] shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Rojo Eleganzza</p>
                            <p className="text-xs font-mono text-slate-500">#A31D1D</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-black shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Negro Profundo</p>
                            <p className="text-xs font-mono text-slate-500">#000000</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-white border border-slate-200 shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Blanco Puro</p>
                            <p className="text-xs font-mono text-slate-500">#FFFFFF</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-white mb-6">Tipografía de Marca</h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-slate-400 mb-2 font-bold uppercase">Heading / Serif</p>
                      <p className="text-4xl font-serif text-slate-800 dark:text-slate-100">Diseño, Calidad y Atención</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2 font-bold uppercase">Body / Sans</p>
                      <p className="text-lg text-slate-600 dark:text-slate-400">
                        La elegancia no es destacar, sino ser recordado. Nuestros muebles definen espacios con distinción.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}

          <footer className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center lg:text-left">
              &copy; 2026 Eleganzza Muebles. Centro de Operaciones de Marketing.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
