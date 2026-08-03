import { useState, useMemo } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getSupabaseInventory, type Mueble } from "@/lib/api/inventory.functions";
import { generateProductCreative, updateAIContent, deleteAIContent, approveAIContent } from "@/lib/api/ai.functions";
import { 
  Sparkles, 
  Search, 
  Camera, 
  FileText, 
  Layout, 
  MessageSquare, 
  Wand2, 
  History,
  CheckCircle2,
  Clock,
  ChevronRight,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Copy
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CREATIVE_TYPES = [
  { id: "copy", label: "Marketing Copy", icon: FileText, description: "Textos para redes y web" },
  { id: "story", label: "Stories", icon: Camera, description: "Estructura para historias" },
  { id: "post", label: "Post Feed", icon: Layout, description: "Diseño de post cuadrado" },
  { id: "carousel", label: "Carrusel", icon: History, description: "Secuencia de diapositivas" },
  { id: "prompt", label: "AI Prompt", icon: Wand2, description: "Prompt para Midjourney/DALL-E" },
] as const;

export function IAGenerator() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Mueble | null>(null);
  const [selectedType, setSelectedType] = useState<typeof CREATIVE_TYPES[number]["id"] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { data: records, refetch } = useSuspenseQuery({
    queryKey: ['supabase-inventory'],
    queryFn: () => getSupabaseInventory(),
  });

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return records || [];
    return (records || []).filter(r => 
      r.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.categoria?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [records, searchTerm]);

  const handleGenerate = async () => {
    if (!selectedProduct || !selectedType) {
      toast.error("Selecciona un producto y un tipo de contenido");
      return;
    }

    setIsGenerating(true);
    try {
      // Intentar obtener prompts personalizados de localStorage
      const savedPrompts = localStorage.getItem('eleganzza_ai_prompts');
      let customPrompt = undefined;
      let customSystem = undefined;
      
      if (savedPrompts) {
        try {
          const config = JSON.parse(savedPrompts);
          if (config[selectedType]) {
            customSystem = config[selectedType].system;
            customPrompt = config[selectedType].user;
          }
        } catch (e) {
          console.error("Error parsing saved prompts", e);
        }
      }

      const content = await generateProductCreative({
        data: {
          muebleId: selectedProduct.id,
          type: selectedType,
          customSystem,
          customPrompt
        }
      });
      setGeneratedContent(content);
      toast.success("Contenido generado y vinculado con éxito");
      refetch(); // Para actualizar los detalles vinculados
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Error desconocido";
      toast.error(msg.slice(0, 200));
    } finally {
      setIsGenerating(false);
    }
  };

  const hasContentFor = (mueble: Mueble, type: string) => {
    return mueble.detalles?.ai_content?.some((c: any) => c.type === type);
  };

  const handleUpdate = async (index: number) => {
    if (!selectedProduct) return;
    try {
      await updateAIContent({
        data: {
          muebleId: selectedProduct.id,
          index,
          content: editText
        }
      });
      toast.success("Contenido actualizado");
      setEditingIndex(null);
      refetch();
    } catch (error) {
      toast.error("Error al actualizar");
    }
  };

  const handleDelete = async (index: number) => {
    if (!selectedProduct || !confirm("¿Estás seguro de eliminar este contenido?")) return;
    try {
      await deleteAIContent({
        data: {
          muebleId: selectedProduct.id,
          index
        }
      });
      toast.success("Contenido eliminado");
      refetch();
    } catch (error) {
      toast.error("Error al eliminar");
    }
  };

  const handleApprove = async (index: number) => {
    if (!selectedProduct) return;
    try {
      await approveAIContent({
        data: {
          muebleId: selectedProduct.id,
          index
        }
      });
      toast.success("Contenido aprobado y publicado");
      refetch();
    } catch (error) {
      toast.error("Error al aprobar contenido");
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-200px)] relative overflow-hidden">
      {/* Selector de Producto (Slide Sidebar) */}
      <div 
        className={cn(
          "flex flex-col gap-4 transition-all duration-300 ease-in-out shrink-0",
          isSidebarOpen ? "w-80" : "w-0 opacity-0 -translate-x-full"
        )}
      >
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200 dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-serif">1. Elige un Producto</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 lg:hidden" 
                onClick={() => setIsSidebarOpen(false)}
              >
                <ChevronRight className="h-4 w-4 rotate-180" />
              </Button>
            </div>
            <CardDescription>Selecciona el mueble para el contenido</CardDescription>
            <div className="relative mt-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar producto..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-2">
                {filteredProducts.map(product => (
                  <button
                    key={product.id}
                    onClick={() => {
                        setSelectedProduct(product);
                        setGeneratedContent(null);
                        // Opcionalmente cerrar en móvil tras elegir
                        if (window.innerWidth < 1024) setIsSidebarOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left group border",
                      selectedProduct?.id === product.id
                        ? "bg-slate-900 border-slate-900 dark:bg-white dark:border-white text-white dark:text-slate-900"
                        : "bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-500 text-slate-600 dark:text-slate-300"
                    )}
                  >
                    <div className="h-10 w-10 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                      {product.galeria?.[0]?.url ? (
                        <img src={product.galeria[0].url} className="w-full h-full object-cover" alt="" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Sparkles className="h-4 w-4 text-slate-300" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.nombre}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] opacity-60 uppercase font-bold tracking-tighter">
                          {product.categoria || "Sin categoría"}
                        </span>
                        {product.detalles?.ai_content?.length > 0 && (
                          <Badge variant="secondary" className="h-4 px-1 text-[8px] bg-emerald-100 text-emerald-700 border-0">
                            {product.detalles.ai_content.length} IA
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Botón para reabrir el slide si está cerrado */}
      {!isSidebarOpen && (
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-0 top-4 z-10 rounded-l-none border border-l-0 shadow-sm animate-in slide-in-from-left-2"
          onClick={() => setIsSidebarOpen(true)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}

      {/* Selector de Tipo y Generador */}
      <div className="flex-1 space-y-6 flex flex-col min-w-0">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 min-h-0">

          {/* Tipos de Contenido */}
          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-lg font-serif">2. Tipo de Contenido</CardTitle>
              <CardDescription>¿Qué quieres generar hoy?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {CREATIVE_TYPES.map(type => {
                const hasExisting = selectedProduct && hasContentFor(selectedProduct, type.id);
                return (
                  <button
                    key={type.id}
                    onClick={() => {
                        setSelectedType(type.id);
                        setGeneratedContent(null);
                    }}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left group",
                      selectedType === type.id
                        ? "border-indigo-500 bg-indigo-50/50"
                        : "border-slate-100 hover:border-slate-200 bg-white"
                    )}
                  >
                    <div className={cn(
                      "h-10 w-10 rounded-full flex items-center justify-center shrink-0 transition-colors",
                      selectedType === type.id ? "bg-indigo-500 text-white" : "bg-slate-50 text-slate-400 group-hover:bg-slate-100"
                    )}>
                      <type.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{type.label}</p>
                        {hasExisting && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                      </div>
                      <p className="text-xs text-slate-500">{type.description}</p>
                    </div>
                  </button>
                );
              })}
            </CardContent>
            <div className="p-6 pt-0 mt-auto">
              <Button 
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white h-12 rounded-xl text-lg font-serif"
                disabled={!selectedProduct || !selectedType || isGenerating}
                onClick={handleGenerate}
              >
                {isGenerating ? (
                  <><Clock className="h-5 w-5 mr-2 animate-spin" /> Generando...</>
                ) : (
                  <><Sparkles className="h-5 w-5 mr-2" /> Crear Magia con IA</>
                )}
              </Button>
            </div>
          </Card>

          {/* Resultado / Historial */}
          <Card className="border-slate-200 flex flex-col overflow-hidden">
            <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <History className="h-5 w-5 text-slate-400" />
                {generatedContent ? "Contenido Generado" : "Historial del Producto"}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {generatedContent ? (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 prose prose-slate max-w-none">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">
                          {generatedContent}
                        </pre>
                      </div>
                      <Button variant="outline" className="w-full" onClick={() => setGeneratedContent(null)}>
                        Ver todo el historial
                      </Button>
                    </div>
                  ) : (selectedProduct && selectedProduct.detalles?.ai_content?.length > 0) ? (
                    <div className="space-y-4">
                      {selectedProduct.detalles.ai_content.map((item: any, idx: number) => (
                        <div key={idx} className="p-4 rounded-xl border border-slate-100 bg-white hover:bg-slate-50 transition-colors">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="capitalize text-[10px]">
                                {item.type}
                              </Badge>
                              {item.status === "draft" ? (
                                <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-0 text-[8px] uppercase font-bold">
                                  Borrador
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0 text-[8px] uppercase font-bold">
                                  Publicado
                                </Badge>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              {new Date(item.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          
                          {editingIndex === idx ? (
                            <div className="space-y-2">
                              <textarea
                                className="w-full text-xs p-2 border rounded-lg bg-slate-50 min-h-[100px] font-sans"
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button size="sm" className="h-7 text-[10px]" onClick={() => handleUpdate(idx)}>
                                  <Save className="h-3 w-3 mr-1" /> Guardar
                                </Button>
                                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => setEditingIndex(null)}>
                                  <X className="h-3 w-3 mr-1" /> Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <p className="text-xs text-slate-600 line-clamp-3 italic">
                                "{item.content.substring(0, 150)}..."
                              </p>
                              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-slate-50">
                                <Button 
                                  variant="link" 
                                  className="p-0 h-auto text-[10px] text-indigo-600 font-bold"
                                  onClick={() => setGeneratedContent(item.content)}
                                >
                                  Ver completo →
                                </Button>
                                <div className="ml-auto flex items-center gap-1">
                                  {item.status === "draft" && (
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6 text-emerald-600 hover:bg-emerald-50" 
                                      onClick={() => handleApprove(idx)}
                                      title="Aprobar y publicar"
                                    >
                                      <CheckCircle2 className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => handleCopy(item.content)} title="Copiar">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-indigo-600" onClick={() => {
                                    setEditingIndex(idx);
                                    setEditText(item.content);
                                  }} title="Editar">
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-red-600" onClick={() => handleDelete(idx)} title="Eliminar">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )).reverse()}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
                      <Sparkles className="h-12 w-12 mb-4" />
                      <p className="text-sm font-medium">No hay contenido generado aún</p>
                      <p className="text-xs">Selecciona un tipo y dale a 'Crear Magia'</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
