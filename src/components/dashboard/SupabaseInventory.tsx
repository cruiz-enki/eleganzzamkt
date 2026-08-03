import { useState, useRef, useMemo } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSupabaseInventory, 
  upsertMueble, 
  deleteMueble, 
  uploadToDrive,
  type Mueble 
} from "@/lib/api/inventory.functions";
import { cleanProductImage } from "@/lib/api/ai.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Package, Info, Image as ImageIcon, RefreshCcw, Plus, Edit, Trash2, FolderOpen, Upload, Loader2, FileDown, Filter, ArrowUpDown, ChevronDown, Eye, Settings2, ChevronLeft, ChevronRight, Wand2, LayoutGrid, List } from "lucide-react";
import { CSVImporter } from "./CSVImporter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Masonry from "react-layout-masonry";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

type SortConfig = {
  key: keyof Mueble | "";
  direction: "asc" | "desc";
};

export function SupabaseInventory() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<Mueble | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  
  // New States for Filter, Sort and Column Visibility
  const [sortConfig, setSortConfig] = useState<SortConfig>({ key: "", direction: "asc" });
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(["nombre", "categoria", "precio", "acciones"]));
  const [viewMode, setViewMode] = useState<"table" | "gallery">("table");
  const [lightboxIndex, setLightboxIndex] = useState(-1);


  // Form state
  const [formData, setFormData] = useState<Partial<Mueble>>({
    nombre: "",
    categoria: "",
    precio: 0,
    precio_2: 0,
    precio_3: 0,
    descripcion: "",
    galeria: [],
  });

  const { data: records, refetch } = useSuspenseQuery({
    queryKey: ['supabase-inventory'],
    queryFn: () => getSupabaseInventory(),
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<Mueble>) => {
      const savedProduct = await upsertMueble({ data });
      if (pendingFiles.length === 0) return savedProduct;

      let folderId = savedProduct.detalles?.google_drive_folder_id;
      
      // Si por alguna razón no tiene carpeta (ej. importación previa sin carpeta), intentamos crearla ahora
      if (!folderId) {
        console.log("No folder ID found for product, attempting to update to ensure folder exists...");
        // La lógica de upsertMueble ya crea la carpeta si no existe al insertar, 
        // pero para actualizaciones de registros viejos sin carpeta, forzamos una re-evaluación si fuera necesario.
        // En este flujo, confiamos en que upsertMueble devolvió una carpeta.
        throw new Error("El producto se guardó, pero no se encontró una carpeta de Google Drive vinculada para las fotos");
      }

      setUploading(true);
      const uploadedPhotos: Array<{ id: string; url: string }> = [];
      try {
        for (const file of pendingFiles) {
          const base64 = await fileToBase64(file);
          const uploaded = await uploadToDrive({
            data: {
              fileName: file.name,
              mimeType: file.type || "application/octet-stream",
              base64,
              folderId,
            },
          });
          uploadedPhotos.push(uploaded);
        }

        // Actualizamos el producto con las nuevas fotos en la galería
        const updatedProduct = await upsertMueble({
          data: {
            id: savedProduct.id,
            galeria: [...(savedProduct.galeria || []), ...uploadedPhotos],
          },
        });
        
        return updatedProduct;
      } catch (error) {
        await queryClient.invalidateQueries({ queryKey: ["supabase-inventory"] });
        const message = error instanceof Error ? error.message : "Error desconocido";
        throw new Error(`El producto se guardó, pero no todas las fotos pudieron subirse a la carpeta de Drive: ${message}`);
      } finally {
        setUploading(false);
      }
    },
    onSuccess: (data) => {
      console.log("Upsert success:", data);
      queryClient.invalidateQueries({ queryKey: ['supabase-inventory'] });
      toast.success(isAdding ? "Producto creado con éxito" : "Producto actualizado con éxito");
      closeForm();
    },
    onError: (error) => {
      console.error("Upsert error details:", error);
      toast.error("Error al guardar: " + error.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => deleteMueble({ data: { id } }))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-inventory'] });
      toast.success(selectedIds.size > 1 ? `${selectedIds.size} productos eliminados` : "Producto eliminado");
      setSelectedRecord(null);
      setSelectedIds(new Set());
    },
    onError: (error) => {
      toast.error("Error al eliminar: " + error.message);
    }
  });

  const categories = useMemo(() => {
    const cats = new Set((records || []).map(r => r.categoria).filter(Boolean));
    return Array.from(cats).sort();
  }, [records]);

  const processedRecords = useMemo(() => {
    let result = [...(records || [])];

    // Search filter
    if (searchTerm) {
      result = result.filter((r) =>
        Object.values(r).some(val =>
          String(val).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Category filter
    if (categoryFilter !== "all") {
      result = result.filter(r => r.categoria === categoryFilter);
    }

    // Sort
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key as keyof Mueble];
        const bValue = b[sortConfig.key as keyof Mueble];

        if (aValue === bValue) return 0;
        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        const comparison = String(aValue).localeCompare(String(bValue), undefined, { numeric: true });
        return sortConfig.direction === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [records, searchTerm, categoryFilter, sortConfig]);

  const lightboxSlides = useMemo(() => {
    return processedRecords.map(record => {
      const photos = [...(record.galeria || []), ...(record.fotos || [])];
      return {
        src: photos.length > 0 ? photos[0].url : "",
        title: record.nombre,
        description: `${record.categoria} - ${record.precio ? currency.format(record.precio) : ""}`,
      };
    }).filter(slide => slide.src);
  }, [processedRecords]);

  const handleSort = (key: keyof Mueble) => {
    setSortConfig(current => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  };

  const toggleColumn = (columnId: string) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(columnId)) {
        if (next.size > 1) next.delete(columnId); // Don't hide all columns
      } else {
        next.add(columnId);
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === processedRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedRecords.map(r => r.id)));
    }
  };

  const handleEdit = (record: Mueble) => {
    setFormData({
      ...record,
      galeria: record.galeria || []
    });
    setPendingFiles([]);
    setIsEditing(true);
    setSelectedRecord(null); // Close detail view if open
  };

  const handleAdd = () => {
    setFormData({
      nombre: "",
      categoria: "",
      precio: 0,
      precio_2: 0,
      precio_3: 0,
      descripcion: "",
      fotos: [],
      galeria: [],
      detalles: {},
    });
    setIsAdding(true);
    setPendingFiles([]);
  };

  const closeForm = () => {
    setIsEditing(false);
    setIsAdding(false);
    setPendingFiles([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit triggered. isAdding:", isAdding, "isEditing:", isEditing);
    
    if (!formData.nombre) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    try {
      await upsertMutation.mutateAsync(formData);
    } catch (err) {
      console.error("Mutation call failed:", err);
      toast.error("Error al iniciar el guardado");
    }
  };

  const fileToBase64 = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result);
        resolve(result.split(',')[1] ?? "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setPendingFiles((current) => [...current, ...Array.from(files)]);
    toast.info(`${files.length} foto(s) lista(s); se subirán al guardar el producto`);
    e.target.value = "";
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
  };


  const currentIndex = useMemo(() => {
    if (!selectedRecord) return -1;
    return processedRecords.findIndex(r => r.id === selectedRecord.id);
  }, [selectedRecord, processedRecords]);

  const handlePrev = () => {
    if (currentIndex > 0) {
      const prevRecord = processedRecords[currentIndex - 1];
      if (prevRecord) setSelectedRecord(prevRecord);
    }
  };

  const handleNext = () => {
    if (currentIndex < processedRecords.length - 1) {
      const nextRecord = processedRecords[currentIndex + 1];
      if (nextRecord) setSelectedRecord(nextRecord);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[300px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en inventario de Supabase..."
            className="pl-8 bg-white/50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <Button 
              variant={viewMode === "table" ? "secondary" : "ghost"} 
              size="sm" 
              className={cn("h-7 px-2 text-[10px] font-bold uppercase", viewMode === "table" ? "bg-white shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("table")}
            >
              <List className="h-3.5 w-3.5 mr-1" />
              Lista
            </Button>
            <Button 
              variant={viewMode === "gallery" ? "secondary" : "ghost"} 
              size="sm" 
              className={cn("h-7 px-2 text-[10px] font-bold uppercase", viewMode === "gallery" ? "bg-white shadow-sm" : "text-slate-500")}
              onClick={() => setViewMode("gallery")}
            >
              <LayoutGrid className="h-3.5 w-3.5 mr-1" />
              Galería
            </Button>
          </div>

          {/* Category Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-slate-200">
                <Filter className="h-4 w-4 mr-2" />
                {categoryFilter === "all" ? "Categorías" : categoryFilter}
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuItem onClick={() => setCategoryFilter("all")}>
                Todas las categorías
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {categories.map(cat => (
                <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat!)}>
                  {cat}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Columns Visibility */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 border-slate-200">
                <Eye className="h-4 w-4 mr-2" />
                Columnas
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[180px]">
              <DropdownMenuLabel>Mostrar columnas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={visibleColumns.has("nombre")} onCheckedChange={() => toggleColumn("nombre")}>
                Nombre
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.has("categoria")} onCheckedChange={() => toggleColumn("categoria")}>
                Categoría
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.has("precio")} onCheckedChange={() => toggleColumn("precio")}>
                Precio 1
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.has("precio_2")} onCheckedChange={() => toggleColumn("precio_2")}>
                Precio 2
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem checked={visibleColumns.has("precio_3")} onCheckedChange={() => toggleColumn("precio_3")}>
                Precio 3
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedIds.size > 0 && (
            <Button 
              size="sm" 
              variant="destructive" 
              className="h-9"
              onClick={() => {
                if (confirm(`¿Estás seguro de eliminar ${selectedIds.size} productos?`)) {
                  deleteMutation.mutate(Array.from(selectedIds));
                }
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar ({selectedIds.size})
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline" 
            className="h-9 border-slate-200 text-slate-600"
            onClick={() => refetch()}
          >
            <RefreshCcw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
          
          <CSVImporter />
          
          <Button 
            size="sm" 
            className="h-9 bg-black text-white hover:bg-black/90"
            onClick={handleAdd}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Producto
          </Button>
        </div>
      </div>

      {viewMode === "table" ? (
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50/50 border-b border-slate-100">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 py-4">
                  <input 
                    type="checkbox" 
                    className="rounded border-slate-300" 
                    checked={processedRecords.length > 0 && selectedIds.size === processedRecords.length}
                    onChange={toggleSelectAll}
                  />
                </TableHead>
                {visibleColumns.has("nombre") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort("nombre")}>
                    <div className="flex items-center gap-1">
                      Producto
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.has("categoria") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 cursor-pointer hover:text-black transition-colors" onClick={() => handleSort("categoria")}>
                    <div className="flex items-center gap-1">
                      Categoría
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.has("precio") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right cursor-pointer hover:text-black transition-colors" onClick={() => handleSort("precio")}>
                    <div className="flex items-center justify-end gap-1">
                      Precio 1
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.has("precio_2") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right cursor-pointer hover:text-black transition-colors" onClick={() => handleSort("precio_2")}>
                    <div className="flex items-center justify-end gap-1">
                      Precio 2
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.has("precio_3") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right cursor-pointer hover:text-black transition-colors" onClick={() => handleSort("precio_3")}>
                    <div className="flex items-center justify-end gap-1">
                      Precio 3
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.has("acciones") && (
                  <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right">Acciones</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {processedRecords.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.size + 1} className="text-center py-12 text-sm text-slate-400">
                    No se encontraron muebles en Supabase.
                  </TableCell>
                </TableRow>
              ) : processedRecords.map((record) => (
                <TableRow 
                  key={record.id} 
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors cursor-pointer group border-b border-slate-50 last:border-0",
                    selectedIds.has(record.id) && "bg-blue-50/30"
                  )}
                >
                  <TableCell className="py-4" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300" 
                      checked={selectedIds.has(record.id)}
                      onChange={() => toggleSelect(record.id)}
                    />
                  </TableCell>
                  {visibleColumns.has("nombre") && (
                    <TableCell className="py-4" onClick={() => setSelectedRecord(record)}>
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0 cursor-zoom-in"
                          onClick={(e) => {
                            e.stopPropagation();
                            const slideIndex = lightboxSlides.findIndex(s => s.title === record.nombre);
                            if (slideIndex !== -1) setLightboxIndex(slideIndex);
                          }}
                        >
                          {record.fotos && Array.isArray(record.fotos) && (record.fotos[0] as any)?.url ? (
                            <img src={(record.fotos[0] as any).url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <span className="font-medium text-slate-700 group-hover:text-black transition-colors">
                          {record.nombre}
                        </span>
                      </div>
                    </TableCell>
                  )}

                  {visibleColumns.has("categoria") && (
                    <TableCell className="py-4" onClick={() => setSelectedRecord(record)}>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal border-0">
                        {record.categoria || "Sin categoría"}
                      </Badge>
                    </TableCell>
                  )}
                  
                  {visibleColumns.has("precio") && (
                    <TableCell className="text-right py-4 font-semibold text-slate-700" onClick={() => setSelectedRecord(record)}>
                      {record.precio ? currency.format(record.precio) : "—"}
                    </TableCell>
                  )}

                  {visibleColumns.has("precio_2") && (
                    <TableCell className="text-right py-4 font-semibold text-slate-700" onClick={() => setSelectedRecord(record)}>
                      {record.precio_2 ? currency.format(record.precio_2) : "—"}
                    </TableCell>
                  )}

                  {visibleColumns.has("precio_3") && (
                    <TableCell className="text-right py-4 font-semibold text-slate-700" onClick={() => setSelectedRecord(record)}>
                      {record.precio_3 ? currency.format(record.precio_3) : "—"}
                    </TableCell>
                  )}

                  {visibleColumns.has("acciones") && (
                    <TableCell className="text-right py-4">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-slate-400 hover:text-slate-900"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(record);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("¿Estás seguro de eliminar este producto?")) {
                              deleteMutation.mutate([record.id]);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="min-h-[500px]">
          {processedRecords.length === 0 ? (
            <div className="w-full text-center py-24 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">
              No hay productos para mostrar en la galería.
            </div>
          ) : (
            <Masonry columns={{ 640: 1, 768: 2, 1024: 3, 1280: 4 }} gap={16}>
              {processedRecords.map((record) => {
                const photos = [...(record.galeria || []), ...(record.fotos || [])];
                return (
                  <div 
                    key={record.id} 
                    className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer"
                    onClick={() => setSelectedRecord(record)}
                  >
                    <div className="relative aspect-auto min-h-[200px] bg-slate-50">
                      {photos.length > 0 ? (
                        <img 
                          src={photos[0].url} 
                          alt={record.nombre} 
                          className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2">
                          <Package className="w-8 h-8 opacity-20" />
                          <span className="text-[10px] uppercase font-bold tracking-widest">Sin imagen</span>
                        </div>
                      )}
                      
                      {/* Selection Overlay */}
                      <div 
                        className="absolute top-3 left-3 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(record.id);
                        }}
                      >
                        <div className={cn(
                          "w-5 h-5 rounded border border-white/50 backdrop-blur-sm flex items-center justify-center transition-colors",
                          selectedIds.has(record.id) ? "bg-black text-white" : "bg-black/20"
                        )}>
                          {selectedIds.has(record.id) && <Plus className="w-3 h-3 rotate-45 shrink-0" />}
                        </div>
                      </div>

                      {/* Info Overlay */}
                      <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="flex justify-between items-end text-white">
                          <div className="space-y-1">
                            <h3 className="font-bold text-sm leading-tight">{record.nombre}</h3>
                            <p className="text-[10px] opacity-70 uppercase tracking-wider">{record.categoria}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold">{record.precio ? currency.format(record.precio) : "—"}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Masonry>
          )}
        </div>
      )}


      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-visible bg-white border-none shadow-2xl">
          {selectedRecord && (
            <div className="relative">
              {/* Lateral Navigation Buttons */}
              <div className="absolute top-1/2 -left-16 -translate-y-1/2 hidden lg:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all",
                    currentIndex <= 0 && "opacity-20 cursor-not-allowed"
                  )}
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </div>

              <div className="absolute top-1/2 -right-16 -translate-y-1/2 hidden lg:block">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn(
                    "h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm transition-all",
                    currentIndex >= processedRecords.length - 1 && "opacity-20 cursor-not-allowed"
                  )}
                  onClick={handleNext}
                  disabled={currentIndex >= processedRecords.length - 1}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>

              {/* Mobile Navigation */}
              <div className="absolute top-4 right-16 z-50 flex gap-1 lg:hidden">
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm"
                  onClick={handleNext}
                  disabled={currentIndex >= processedRecords.length - 1}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px] overflow-hidden rounded-lg">
              <div className="w-full md:w-1/2 bg-slate-100 relative group overflow-hidden">
                {((selectedRecord.galeria && Array.isArray(selectedRecord.galeria) && selectedRecord.galeria.length > 0) || 
                  (selectedRecord.fotos && Array.isArray(selectedRecord.fotos) && selectedRecord.fotos.length > 0)) ? (
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-2 p-2">
                      {[...(selectedRecord.galeria || []), ...(selectedRecord.fotos || [])].map((photo: any, i: number) => {
                        const url = photo.url;
                        if (!url) return null;
                        return (
                          <div key={i} className="relative group/photo overflow-hidden rounded-lg shadow-sm bg-white">
                            <img 
                              src={url} 
                              alt={`${selectedRecord.nombre} ${i + 1}`} 
                              className="w-full"
                            />
                            <div className="absolute top-2 right-2 z-10">
                              <Button
                                size="sm"
                                variant="secondary"
                                className="h-8 text-[10px] gap-1 px-2 font-bold uppercase shadow-lg border border-slate-200"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    toast.loading("IA analizando imagen...");
                                    const result = await cleanProductImage({ data: { imageUrl: url } });
                                    toast.success("Análisis de IA completado");
                                    console.log("IA Clean Result:", result);
                                    // Mostramos el resultado en un toast informativo para que el usuario vea que funcionó
                                    toast.info(result, { duration: 5000 });
                                  } catch (e) {
                                    toast.error("Error al procesar con IA. Verifica tu conexión.");
                                  }
                                }}
                              >
                                <Wand2 className="h-3 w-3" />
                                Limpiar con IA
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <ImageIcon className="w-12 h-12 opacity-20" />
                    <span className="text-xs font-medium">Sin fotos disponibles</span>
                  </div>
                )}
              </div>

              <div className="w-full md:w-1/2 flex flex-col bg-white">
                <div className="p-8 flex-1 overflow-y-auto">
                  <DialogHeader className="mb-8 space-y-4">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-black text-white hover:bg-black/90 px-3 py-1 rounded-full uppercase text-[10px] tracking-widest border-0">
                        Ficha de Supabase
                      </Badge>
                      {selectedRecord.categoria && (
                        <Badge variant="outline" className="border-slate-200 text-slate-500 rounded-full font-normal">
                          {selectedRecord.categoria}
                        </Badge>
                      )}
                    </div>
                    <DialogTitle className="text-3xl font-bold text-slate-900 tracking-tight leading-none">
                      {selectedRecord.nombre}
                    </DialogTitle>
                  </DialogHeader>

                  <div className="grid gap-8">
                    <div className="grid grid-cols-1 gap-4">
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Precio 1</span>
                        <div className="h-px flex-1 bg-slate-100"></div>
                        <span className="text-xl font-bold text-slate-900">
                          {selectedRecord.precio ? currency.format(selectedRecord.precio) : "—"}
                        </span>
                      </div>
                      
                      {selectedRecord.precio_2 !== undefined && selectedRecord.precio_2 !== null && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Precio 2</span>
                          <div className="h-px flex-1 bg-slate-100"></div>
                          <span className="text-xl font-bold text-slate-900">
                            {currency.format(selectedRecord.precio_2)}
                          </span>
                        </div>
                      )}

                      {selectedRecord.precio_3 !== undefined && selectedRecord.precio_3 !== null && (
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Precio 3</span>
                          <div className="h-px flex-1 bg-slate-100"></div>
                          <span className="text-xl font-bold text-slate-900">
                            {currency.format(selectedRecord.precio_3)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                        <Info className="w-3 h-3" /> Descripción y Detalles
                      </h4>
                      <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100">
                        {selectedRecord.detalles?.google_drive_folder_id && (
                          <div className="flex flex-col gap-1 border-b border-slate-200/50 pb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Google Drive</span>
                            <a 
                              href={`https://drive.google.com/drive/folders/${selectedRecord.detalles.google_drive_folder_id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline flex items-center gap-2 font-medium"
                            >
                              <FolderOpen className="w-4 h-4" />
                              Abrir carpeta de activos
                            </a>
                          </div>
                        )}
                        {selectedRecord.descripcion && (
                          <div className="flex flex-col gap-1 border-b border-slate-200/50 pb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Descripción</span>
                            <span className="text-sm text-slate-700">{selectedRecord.descripcion}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                  <Button 
                    className="flex-1 bg-slate-100 text-slate-900 hover:bg-slate-200 h-12 rounded-xl transition-all font-medium border-0"
                    onClick={() => handleEdit(selectedRecord)}
                  >
                    Editar Producto
                  </Button>
                  <Button variant="outline" className="h-12 w-12 rounded-xl border-slate-200 bg-white hover:bg-slate-50" onClick={() => setSelectedRecord(null)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        </DialogContent>
      </Dialog>

      {/* Edit/Add Dialog */}
      <Dialog open={isEditing || isAdding} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-2xl bg-white border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
          <form onSubmit={handleSubmit} className="flex flex-col overflow-hidden">
            <div className="p-8 overflow-y-auto flex-1">
              <DialogHeader className="mb-8">
                <DialogTitle className="text-2xl font-bold text-slate-900">
                  {isAdding ? "Nuevo Producto" : "Editar Producto"}
                </DialogTitle>
              </DialogHeader>

              <div className="grid gap-6">
                <div className="grid gap-2">
                  <Label htmlFor="nombre">Nombre del Producto</Label>
                  <Input 
                    id="nombre" 
                    value={formData.nombre || ""} 
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})}
                    placeholder="Ej: Sofá Minimalista"
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="precio">Precio 1 (MXN)</Label>
                    <Input 
                      id="precio" 
                      type="number"
                      value={formData.precio || 0} 
                      onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="precio_2">Precio 2 (MXN)</Label>
                    <Input 
                      id="precio_2" 
                      type="number"
                      value={formData.precio_2 || 0} 
                      onChange={(e) => setFormData({...formData, precio_2: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="precio_3">Precio 3 (MXN)</Label>
                    <Input 
                      id="precio_3" 
                      type="number"
                      value={formData.precio_3 || 0} 
                      onChange={(e) => setFormData({...formData, precio_3: parseFloat(e.target.value)})}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="categoria">Categoría</Label>
                  <Input 
                    id="categoria" 
                    value={formData.categoria || ""} 
                    onChange={(e) => setFormData({...formData, categoria: e.target.value})}
                    placeholder="Ej: Sala"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Galería de Imágenes (Múltiples fotos)</Label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {(formData.galeria || []).map((f: any, idx: number) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                        <img src={f.url} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => {
                            const newGaleria = [...(formData.galeria || [])];
                            newGaleria.splice(idx, 1);
                            setFormData({ ...formData, galeria: newGaleria });
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    {pendingFiles.map((file, idx) => (
                      <div key={`${file.name}-${idx}`} className="relative aspect-square rounded-lg border border-slate-200 bg-slate-50 p-2 flex flex-col items-center justify-center text-center">
                        <ImageIcon className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-600 line-clamp-2 break-all">{file.name}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="destructive"
                          className="absolute right-1 top-1 h-6 w-6"
                          onClick={() => removePendingFile(idx)}
                          aria-label={`Quitar ${file.name}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <label className={cn(
                      "aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-300 hover:bg-slate-50 transition-all",
                      uploading && "opacity-50 cursor-not-allowed"
                    )}>
                      {uploading ? (
                        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-6 w-6 text-slate-400" />
                          <span className="text-[10px] font-medium text-slate-500 mt-1">Subir</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        multiple 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  <Label className="text-xs text-slate-400 font-normal">O pega URLs (separadas por comas)</Label>
                  <Textarea 
                    placeholder="https://ejemplo.com/foto1.jpg, https://ejemplo.com/foto2.jpg"
                    value={(formData.galeria || []).map((f: any) => f.url).join(', ')}
                    onChange={(e) => {
                      const urls = e.target.value.split(',').map(u => u.trim()).filter(u => u !== '');
                      setFormData({...formData, galeria: urls.map(url => ({ url }))});
                    }}
                    rows={2}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="descripcion">Descripción</Label>
                  <Textarea 
                    id="descripcion" 
                    value={formData.descripcion || ""} 
                    onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
                    placeholder="Describe el mueble..."
                    rows={4}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="bg-slate-50 p-6 border-t border-slate-100 flex gap-3 sm:justify-end">
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                className="bg-black text-white hover:bg-black/90 px-8"
                disabled={upsertMutation.isPending || uploading}
              >
                {upsertMutation.isPending ? "Guardando..." : "Guardar Producto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
