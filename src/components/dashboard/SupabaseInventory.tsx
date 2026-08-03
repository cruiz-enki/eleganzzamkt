import { useState } from "react";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getSupabaseInventory, 
  upsertMueble, 
  deleteMueble, 
  type Mueble 
} from "@/lib/api/inventory.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Package, Info, Image as ImageIcon, RefreshCcw, Plus, Edit, Trash2, FolderOpen } from "lucide-react";
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

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function SupabaseInventory() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<Mueble | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Mueble>>({
    nombre: "",
    categoria: "",
    precio: 0,
    descripcion: "",
  });

  const { data: records, refetch } = useSuspenseQuery({
    queryKey: ['supabase-inventory'],
    queryFn: () => getSupabaseInventory(),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Partial<Mueble>) => upsertMueble({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supabase-inventory'] });
      toast.success(isAdding ? "Producto creado con éxito" : "Producto actualizado con éxito");
      closeForm();
    },
    onError: (error) => {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    upsertMutation.mutate(formData);
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
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">Precio</span>
                      <div className="h-px flex-1 bg-slate-100"></div>
                      <span className="text-2xl font-bold text-slate-900">
                        {selectedRecord.precio ? currency.format(selectedRecord.precio) : "No disponible"}
                      </span>
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
        <DialogContent className="max-w-2xl bg-white border-none shadow-2xl p-0 overflow-hidden">
          <form onSubmit={handleSubmit}>
            <div className="p-8">
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

                <div className="grid grid-cols-2 gap-4">
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
                    <Label htmlFor="precio">Precio (MXN)</Label>
                    <Input 
                      id="precio" 
                      type="number"
                      value={formData.precio || 0} 
                      onChange={(e) => setFormData({...formData, precio: parseFloat(e.target.value)})}
                    />
                  </div>
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
                disabled={upsertMutation.isPending}
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
