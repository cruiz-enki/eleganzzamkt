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
  Sun,
} from "lucide-react";
import { AirtableInventory } from "@/components/dashboard/AirtableInventory";
import { SupabaseInventory } from "@/components/dashboard/SupabaseInventory";
import { WooCommerceSyncQueue } from "@/components/dashboard/WooCommerceSyncQueue";
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
import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/lib/api/stats.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Eleganzza Marketing | Inventario" },
      { name: "description", content: "Centro de operaciones e inventario de Eleganzza Muebles." },
      { property: "og:title", content: "Eleganzza Marketing | Inventario" },
      {
        property: "og:description",
        content: "Centro de operaciones e inventario de Eleganzza Muebles.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type ViewType =
  "dashboard" | "productos" | "campañas" | "catalogos" | "marca" | "configuracion" | "ia-generator";

function Index() {
  const [view, setView] = useState<ViewType>("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("enki-sidebar-open") !== "false";
  });
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("enki-theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    if (typeof window !== "undefined") {
      localStorage.setItem("enki-theme", isDarkMode ? "dark" : "light");
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("enki-sidebar-open", String(isSidebarOpen));
    }
  }, [isSidebarOpen]);

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
      {/* Sidebar — identidad Enki Soluciones */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-gradient-to-b from-[#1B3566] to-[#0f2038] border-r border-white/10 transition-all duration-300 ease-in-out lg:static lg:block",
          isSidebarOpen ? "w-64" : "w-20",
          !isSidebarOpen && "lg:w-20",
        )}
      >
        <div className="h-full flex flex-col">
          {/* Marca */}
          <div
            className={cn(
              "p-4 flex items-center border-b border-white/10",
              isSidebarOpen ? "justify-between" : "justify-center",
            )}
          >
            {isSidebarOpen ? (
              <div className="rounded-lg bg-white px-3 py-2 shadow-sm">
                <img
                  src="/enki-logo.png"
                  alt="Enki Soluciones"
                  className="h-7 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-white p-1.5 shadow-sm">
                <img
                  src="/enki-logo.png"
                  alt="Enki"
                  className="h-6 w-auto max-w-[44px] object-contain"
                />
              </div>
            )}
            {isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="hidden lg:flex text-white/50 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                aria-label="Colapsar menú"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {!isSidebarOpen && (
            <div className="hidden lg:flex justify-center py-2 border-b border-white/10">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="text-white/50 hover:text-white hover:bg-white/10 rounded-lg p-1.5 transition-colors"
                aria-label="Expandir menú"
              >
                <Menu className="h-4 w-4" />
              </button>
            </div>
          )}

          {isSidebarOpen && (
            <div className="px-4 pt-4">
              <p className="text-[10px] uppercase tracking-wider text-white/40 font-semibold">
                Marketing Hub · Eleganzza
              </p>
            </div>
          )}

          <nav className="flex-1 px-3 space-y-1 mt-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                title={!isSidebarOpen ? item.label : undefined}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group",
                  !isSidebarOpen && "justify-center px-0",
                  view === item.id
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-colors",
                    view === item.id ? "text-[#00B5C8]" : "text-white/50 group-hover:text-white",
                  )}
                />
                {isSidebarOpen && (
                  <span className="font-medium text-left text-sm">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          <div className="p-3 border-t border-white/10 space-y-3">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={cn(
                "w-full flex items-center gap-3 rounded-lg px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors",
                !isSidebarOpen && "justify-center px-0",
              )}
              title={isDarkMode ? "Modo Claro" : "Modo Oscuro"}
            >
              {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              {isSidebarOpen && (
                <span className="text-sm font-medium">
                  {isDarkMode ? "Modo Claro" : "Modo Oscuro"}
                </span>
              )}
            </button>

            {isSidebarOpen && (
              <div className="rounded-lg bg-white/5 px-3 py-2.5 border border-white/5">
                <p className="text-[10px] text-[#00B5C8] font-semibold uppercase tracking-wider">
                  Enki Soluciones
                </p>
                <p className="text-xs text-white/50 mt-0.5">Tecnología a tu alcance</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0 overflow-auto">
        <div className="p-6 lg:p-10 max-w-[1600px] mx-auto">
          <header className="mb-10 flex items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-serif font-semibold text-slate-900 dark:text-white tracking-tight capitalize">
                {view === "dashboard" ? "Resumen de Operaciones" : view}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-2 font-medium">
                Eleganzza Marketing Hub
              </p>
            </div>
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="flex shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {isDarkMode ? (
                <Sun className="h-4 w-4 text-[#F5A623]" />
              ) : (
                <Moon className="h-4 w-4 text-[#1B3566]" />
              )}
              <span className="hidden sm:inline">{isDarkMode ? "Modo Claro" : "Modo Oscuro"}</span>
            </button>
          </header>

          {view === "dashboard" && <DashboardView setView={setView} />}

          {view === "productos" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
                    <TableIcon className="h-5 w-5 text-slate-400" />
                    Inventario de Productos
                  </h2>
                  <p className="text-sm text-slate-500">
                    Visualizando datos directamente desde Supabase.
                  </p>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                }
              >
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
                  <p className="text-sm text-slate-500">
                    Crea contenido publicitario vinculado a tus productos de Eleganzza.
                  </p>
                </div>
              </div>
              <Suspense
                fallback={
                  <div className="space-y-4">
                    <Skeleton className="h-40 w-full" />
                    <Skeleton className="h-60 w-full" />
                  </div>
                }
              >
                <IAGenerator />
              </Suspense>
            </div>
          )}

          {view === "configuracion" && (
            <div className="space-y-6">
              <Suspense
                fallback={
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-slate-300" />
                  </div>
                }
              >
                <WooCommerceSyncQueue />
              </Suspense>
              <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <PromptSettings />
              </div>
            </div>
          )}

          {view === "campañas" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <Suspense
                fallback={
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-slate-300" />
                  </div>
                }
              >
                <CampaignsManager />
              </Suspense>
            </div>
          )}

          {view === "catalogos" && (
            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <Suspense
                fallback={
                  <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin h-8 w-8 text-slate-300" />
                  </div>
                }
              >
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
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Logotipo Principal
                      </p>
                      <div className="aspect-video bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center p-8 border border-slate-200 dark:border-slate-700 shadow-inner group relative overflow-hidden">
                        <img
                          src="https://eqshiiiekxbpsdilckuv.supabase.co/storage/v1/object/public/muebles/eleganzzacolor.png"
                          alt="Eleganzza Logo"
                          className="max-h-full object-contain relative z-10"
                          onError={(e) => {
                            // Intento de fallback si la URL de Supabase falla
                            const target = e.target as HTMLImageElement;
                            if (!target.src.includes("placeholder")) {
                              target.src =
                                "https://placehold.co/600x400/000000/FFFFFF?text=Eleganzza+Muebles";
                            }
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        Paleta de Colores
                      </p>
                      <div className="grid grid-cols-1 gap-3">
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-[#A31D1D] shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Rojo Eleganzza
                            </p>
                            <p className="text-xs font-mono text-slate-500">#A31D1D</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-black shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Negro Profundo
                            </p>
                            <p className="text-xs font-mono text-slate-500">#000000</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                          <div className="w-12 h-12 rounded-md bg-white border border-slate-200 shadow-sm" />
                          <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                              Blanco Puro
                            </p>
                            <p className="text-xs font-mono text-slate-500">#FFFFFF</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="pt-8 border-t border-slate-100 dark:border-slate-800">
                  <h3 className="text-xl font-serif font-semibold text-slate-900 dark:text-white mb-6">
                    Tipografía de Marca
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <p className="text-xs text-slate-400 mb-2 font-bold uppercase">
                        Heading / Serif
                      </p>
                      <p className="text-4xl font-serif text-slate-800 dark:text-slate-100">
                        Diseño, Calidad y Atención
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 mb-2 font-bold uppercase">Body / Sans</p>
                      <p className="text-lg text-slate-600 dark:text-slate-400">
                        La elegancia no es destacar, sino ser recordado. Nuestros muebles definen
                        espacios con distinción.
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

function DashboardView({ setView }: { setView: (v: ViewType) => void }) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Resumen de Muebles por Categoría */}
      <section>
        <h3 className="text-lg font-medium text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Package className="h-5 w-5 text-slate-400" />
          Inventario por Categoría
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Object.entries(stats?.categoriesCount || {}).map(([cat, count]) => (
            <div
              key={cat}
              className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase truncate">
                {cat}
              </p>
              <p className="text-2xl font-serif font-bold text-slate-900 dark:text-white mt-1">
                {count}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">Muebles registrados</p>
            </div>
          ))}
          <div className="bg-slate-900 dark:bg-white p-4 rounded-xl shadow-sm flex flex-col justify-between">
            <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase">
              Total General
            </p>
            <div>
              <p className="text-2xl font-serif font-bold text-white dark:text-slate-900">
                {stats?.totalMuebles}
              </p>
              <button
                onClick={() => setView("productos")}
                className="text-[10px] text-slate-300 dark:text-slate-600 font-bold hover:underline mt-1"
              >
                Ver inventario completo
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Campaña Activa */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800 dark:text-white flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-red-500" />
              Campaña Activa
            </h3>
            {stats?.activeCampaign ? (
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold rounded uppercase">
                En curso
              </span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px] font-bold rounded uppercase">
                Ninguna
              </span>
            )}
          </div>
          {stats?.activeCampaign ? (
            <div className="space-y-4">
              <div>
                <p className="text-xl font-serif font-bold text-slate-900 dark:text-white">
                  {stats.activeCampaign.nombre}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                  {stats.activeCampaign.descripcion}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div>
                  <p className="font-bold uppercase text-[9px]">Inicio</p>
                  <p>
                    {stats.activeCampaign.fecha_inicio
                      ? new Date(stats.activeCampaign.fecha_inicio).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="font-bold uppercase text-[9px]">Fin</p>
                  <p>
                    {stats.activeCampaign.fecha_fin
                      ? new Date(stats.activeCampaign.fecha_fin).toLocaleDateString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={() => setView("campañas")}
              >
                Gestionar Campañas
              </Button>
            </div>
          ) : (
            <div className="h-32 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-lg">
              <p className="text-sm text-slate-400">No hay campañas vigentes hoy</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-blue-500 hover:text-blue-600"
                onClick={() => setView("campañas")}
              >
                Crear nueva campaña
              </Button>
            </div>
          )}
        </div>

        {/* Catálogos Cargados */}
        <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-slate-800 dark:text-white flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-500" />
                Catálogos Digitales
              </h3>
            </div>
            <div className="mt-2">
              <p className="text-5xl font-serif font-bold text-slate-900 dark:text-white">
                {stats?.catalogosCount}
              </p>
              <p className="text-sm text-slate-500 mt-1">Archivos PDF procesados</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-[65%]" />
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase">
              <span>Espacio utilizado</span>
              <span>65%</span>
            </div>
            <Button className="w-full text-xs" onClick={() => setView("catalogos")}>
              Cargar Nuevo Catálogo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
