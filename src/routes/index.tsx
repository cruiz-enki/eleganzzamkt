import { createFileRoute } from "@tanstack/react-router";
import { BentoGrid, BentoItem } from "@/components/dashboard/BentoGrid";
import { 
  LayoutDashboard, 
  Database, 
  Cloud, 
  Sparkles, 
  Image as ImageIcon, 
  Table,
  TrendingUp,
  MessageSquare
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-[#fcfbf8] p-6 lg:p-10">
      <header className="mb-10">
        <h1 className="text-3xl font-serif font-semibold text-slate-900 tracking-tight">
          Eleganzza Marketing
        </h1>
        <p className="text-slate-500 mt-2 font-medium">Centro de Operaciones Definitivo</p>
      </header>

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

        {/* Airtable Integration */}
        <BentoItem 
          title="Airtable DB" 
          className="md:col-span-2"
          icon={<Table className="h-4 w-4 text-slate-400" />}
        >
          <div className="flex items-center gap-3 mt-2">
            <div className="h-10 w-10 rounded bg-amber-50 flex items-center justify-center">
              <Database className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Inventario Muebles</p>
              <p className="text-xs text-slate-400">Sincronización en curso...</p>
            </div>
          </div>
        </BentoItem>

        {/* OpenAI Assist */}
        <BentoItem 
          title="AI Creative Lab" 
          className="md:col-span-2 md:row-span-2"
          icon={<Sparkles className="h-4 w-4 text-indigo-400" />}
        >
          <div className="mt-4 space-y-4">
            <p className="text-sm text-slate-600">Generador de copys y análisis de sentimientos activo.</p>
            <div className="space-y-2">
              <div className="h-2 w-full bg-indigo-50 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-400 w-[75%]" />
              </div>
              <p className="text-[10px] text-slate-400 text-right uppercase font-bold tracking-tighter">API Quota: 75%</p>
            </div>
            <button className="w-full py-2 bg-indigo-500 text-white text-xs font-bold rounded hover:bg-indigo-600 transition-colors">
              NUEVO COPY
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
      
      <footer className="mt-12 pt-6 border-t border-slate-200">
        <p className="text-xs text-slate-400 text-center">
          &copy; 2026 Eleganzza Muebles. Todos los derechos reservados.
        </p>
      </footer>
    </div>
  );
}
