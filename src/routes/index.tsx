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
  X
} from "lucide-react";
import { AirtableInventory } from "@/components/dashboard/AirtableInventory";
import { SupabaseInventory } from "@/components/dashboard/SupabaseInventory";
import { Suspense, useState, useEffect } from "react";
import { generateMarketingCopy, cleanProductImage } from "@/lib/api/ai.functions";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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

type ViewType = "dashboard" | "productos" | "campañas" | "marca" | "configuracion";

function Index() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

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
      toast.error("Error al conectar con OpenAI. Verifica tus API Keys.");
    } finally {
      setIsGenerating(false);
    }
  };

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "productos", label: "Productos", icon: Package },
    { id: "campañas", label: "Campañas", icon: Megaphone },
    { id: "marca", label: "Marca", icon: Palette },
    { id: "configuracion", label: "Configuración", icon: Settings },
  ] as const;


  return (
    <div className="min-h-screen bg-[#fcfbf8] flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out lg:static lg:block",
          isSidebarOpen ? "w-64" : "w-20",
          !isSidebarOpen && "lg:w-20"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            {isSidebarOpen ? (
              <h2 className="text-xl font-serif font-bold text-slate-900 truncate">Eleganzza</h2>
            ) : (
              <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center mx-auto">
                <span className="text-white font-serif font-bold">E</span>
              </div>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="hidden lg:flex"
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
                    ? "bg-slate-900 text-white" 
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "h-5 w-5 shrink-0",
                  view === item.id ? "text-white" : "text-slate-400 group-hover:text-slate-900"
                )} />
                {isSidebarOpen && <span className="font-medium">{item.label}</span>}
              </button>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-100">
            {isSidebarOpen ? (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-400 uppercase font-bold">Marketing Team</p>
                <p className="text-sm font-medium text-slate-700 mt-1">Admin Panel</p>
              </div>
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-100 mx-auto" />
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-10 max-w-7xl mx-auto">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-slate-900 tracking-tight capitalize">
                {view === "dashboard" ? "Resumen de Operaciones" : view}
              </h1>
              <p className="text-slate-500 mt-2 font-medium">Eleganzza Marketing Hub</p>
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
                  <h2 className="text-2xl font-semibold text-slate-800">Elegannza Muebles</h2>
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">
                    Gestión centralizada de campañas, activos digitales y base de datos estratégica.
                  </p>
                  <div className="mt-8 grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-400 uppercase font-bold">Activos</p>
                      <p className="text-xl font-semibold text-slate-700">1,240</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                      <p className="text-xs text-slate-400 uppercase font-bold">Leads</p>
                      <p className="text-xl font-semibold text-slate-700">856</p>
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
                  <div className="h-10 w-10 rounded bg-blue-50 flex items-center justify-center">
                    <ImageIcon className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">Unidad Compartida</p>
                    <p className="text-xs text-slate-400 italic">Conexión establecida</p>
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
                  <p className="text-2xl font-semibold text-slate-700">Catálogo</p>
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
                  <p className="text-sm text-slate-600">Genera copys de marketing al instante con GPT-4o.</p>
                  <textarea 
                    className="w-full p-2 text-xs border border-slate-200 rounded-lg focus:ring-1 focus:ring-indigo-400 outline-none resize-none"
                    placeholder="Ej: Sofá de terciopelo azul para sala moderna..."
                    rows={2}
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                  />
                  {aiResult && (
                    <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-slate-700 max-h-32 overflow-y-auto">
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
                  <p className="text-3xl font-serif text-slate-800">+12.4%</p>
                  <p className="text-xs text-slate-400 mt-1">vs mes anterior</p>
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
                    <p className="text-sm font-medium text-slate-700">Supabase Propio</p>
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-tighter">Online</p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
              </BentoItem>
            </BentoGrid>
          )}

          {view === "productos" && (
            <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
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

          {(view === "campañas" || view === "marca" || view === "configuracion") && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-dashed border-slate-300">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <Settings className="h-8 w-8 text-slate-300 animate-spin-slow" />
              </div>
              <h3 className="text-lg font-medium text-slate-800">Sección en desarrollo</h3>
              <p className="text-slate-500 mt-1 text-sm text-center max-w-xs">
                Estamos conectando los módulos de {view} para Eleganzza Marketing.
              </p>
            </div>
          )}

          <footer className="mt-12 pt-6 border-t border-slate-200">
            <p className="text-xs text-slate-400 text-center lg:text-left">
              &copy; 2026 Eleganzza Muebles. Centro de Operaciones de Marketing.
            </p>
          </footer>
        </div>
      </main>
    </div>
  );
}
