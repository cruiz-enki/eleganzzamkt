import { useState, useRef } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSupabaseInventory, 
  upsertMueble, 
  deleteMueble, 
  uploadToDrive,
  type Mueble 
} from "@/lib/api/inventory.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Package, Info, Image as ImageIcon, RefreshCcw, Plus, Edit, Trash2, FolderOpen, Upload, Loader2 } from "lucide-react";
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

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function SupabaseInventory() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<Mueble | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Mueble>>({
    nombre: "",
    categoria: "",
    precio: 0,
    precio_2: 0,
    precio_3: 0,
    descripcion: "",
  });

  const { data: records, refetch } = useSuspenseQuery({
    queryKey: ['supabase-inventory'],
    queryFn: () => getSupabaseInventory(),
  });

  const upsertMutation = useMutation({
    mutationFn: async (data: Partial<Mueble>) => {
      console.log("Calling upsertMueble with:", data);
      return await upsertMueble({ data });
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
    mutationFn: (id: string) => deleteMueble({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-inventory'] });
      toast.success("Producto eliminado");
      setSelectedRecord(null);
    },
    onError: (error) => {
      toast.error("Error al eliminar: " + error.message);
    }
  });

  const filteredRecords = (records || []).filter((r) =>
    Object.values(r).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

  const handleEdit = (record: Mueble) => {
    setFormData(record);
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
      detalles: {},
    });
    setIsAdding(true);
  };

  const closeForm = () => {
    setIsEditing(false);
    setIsAdding(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submit triggered. isAdding:", isAdding, "isEditing:", isEditing);
    
    if (!formData.nombre) {
      toast.error("El nombre del producto es obligatorio");
      return;
    }

    try {
      console.log("Mutating with data:", formData);
      upsertMutation.mutate(formData);
    } catch (err) {
      console.error("Mutation call failed:", err);
      toast.error("Error al iniciar el guardado");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    let folderId = formData.detalles?.google_drive_folder_id;
    
    // If we're adding a new product, we'll use a temporary "root" or wait
    // Actually, to make it work, let's use the ELEGANZZA_FOLDER_ID if no folderId exists
    // (This is defined in inventory.functions.ts but not exported, let's just use the fallback there)
    
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file) {
          // Pass empty string if folderId is missing; the server function should handle the fallback
          const driveFileId = await uploadToDrive(file, folderId || "");
          const driveUrl = `https://lh3.googleusercontent.com/u/0/d/${driveFileId}`;
          newUrls.push(driveUrl);
        }
      }

      const existingFotos = formData.fotos || [];
      const newFotos = [...existingFotos, ...newUrls.map(url => ({ url }))];
      setFormData(prev => ({ ...prev, fotos: newFotos }));
      toast.success(`${files.length} foto(s) subida(s) a Google Drive`);
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error("Error al subir a Drive: " + error.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };
    }
  };

  const removePhoto = (index: number) => {
    const newFotos = [...(formData.fotos || [])];
    newFotos.splice(index, 1);
    setFormData({ ...formData, fotos: newFotos });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar en inventario de Supabase..."
            className="pl-8 bg-white/50 border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          className="h-9 border-slate-200 text-slate-600"
          onClick={() => refetch()}
        >
          <RefreshCcw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
        <Button 
          size="sm" 
          className="h-9 bg-black text-white hover:bg-black/90"
          onClick={handleAdd}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4">Producto</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4">Categoría</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right">Precio</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-12 text-sm text-slate-400">
                  No se encontraron muebles en Supabase.
                </TableCell>
              </TableRow>
            ) : filteredRecords.map((record) => (
              <TableRow 
                key={record.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer group border-b border-slate-50 last:border-0"
              >
                <TableCell className="py-4" onClick={() => setSelectedRecord(record)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
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

                <TableCell className="py-4" onClick={() => setSelectedRecord(record)}>
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal border-0">
                    {record.categoria || "Sin categoría"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right py-4 font-semibold text-slate-700" onClick={() => setSelectedRecord(record)}>
                  {record.precio ? currency.format(record.precio) : "—"}
                </TableCell>
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
                          deleteMutation.mutate(record.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          {selectedRecord && (
            <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px]">
              <div className="w-full md:w-1/2 bg-slate-100 relative group overflow-hidden">
                {selectedRecord.fotos && Array.isArray(selectedRecord.fotos) && selectedRecord.fotos.length > 0 ? (
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-2 p-2">
                      {selectedRecord.fotos.map((photo: any, i: number) => {
                        const url = photo.url;
                        if (!url) return null;
                        return (
                          <img 
                            key={i} 
                            src={url} 
                            alt={`${selectedRecord.nombre} ${i + 1}`} 
                            className="w-full rounded-lg shadow-sm bg-white"
                          />
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
                  <Label>Fotos del Producto</Label>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {(formData.fotos || []).map((f: any, idx: number) => (
                      <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group">
                        <img src={f.url} alt="" className="w-full h-full object-cover" />
                        <button 
                          type="button"
                          onClick={() => removePhoto(idx)}
                          className="absolute top-1 right-1 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
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
                    value={(formData.fotos || []).map((f: any) => f.url).join(', ')}
                    onChange={(e) => {
                      const urls = e.target.value.split(',').map(u => u.trim()).filter(u => u !== '');
                      setFormData({...formData, fotos: urls.map(url => ({ url }))});
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
