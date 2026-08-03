import { useState } from "react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { getSupabaseInventory, type Mueble } from "@/lib/api/inventory.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Database, Search, X, Package, Info, Image as ImageIcon, RefreshCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

export function SupabaseInventory() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<Mueble | null>(null);

  const { data: records, refetch } = useSuspenseQuery({
    queryKey: ['supabase-inventory'],
    queryFn: () => getSupabaseInventory(),
  });

  const filteredRecords = (records || []).filter((r) =>
    Object.values(r).some(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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
      </div>

      <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50/50 border-b border-slate-100">
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4">Producto</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4">Categoría</TableHead>
              <TableHead className="text-[10px] uppercase font-bold text-slate-400 py-4 text-right">Precio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-12 text-sm text-slate-400">
                  No se encontraron muebles en Supabase.
                </TableCell>
              </TableRow>
            ) : filteredRecords.map((record) => (
              <TableRow 
                key={record.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer group border-b border-slate-50 last:border-0"
                onClick={() => setSelectedRecord(record)}
              >
                <TableCell className="py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden border border-slate-200 shrink-0">
                      {record.fotos && Array.isArray(record.fotos) && record.fotos[0]?.url ? (
                        <img src={record.fotos[0].url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-slate-400" />
                      )}
                    </div>
                    <span className="font-medium text-slate-700 group-hover:text-black transition-colors">
                      {record.nombre}
                    </span>
                  </div>
                </TableCell>

                <TableCell className="py-4">
                  <Badge variant="secondary" className="bg-slate-100 text-slate-600 hover:bg-slate-200 font-normal border-0">
                    {record.categoria || "Sin categoría"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right py-4 font-semibold text-slate-700">
                  {record.precio ? currency.format(record.precio) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-white border-none shadow-2xl">
          {selectedRecord && (
            <div className="flex flex-col md:flex-row h-[85vh] md:h-[600px]">
              {/* Carrusel de Fotos */}
              <div className="w-full md:w-1/2 bg-slate-100 relative group overflow-hidden">
                {record.fotos && Array.isArray(record.fotos) && record.fotos.length > 0 ? (
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-2 p-2">
                      {record.fotos.map((photo: any, i: number) => {
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

              {/* Información del Producto */}
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
                        {selectedRecord.descripcion && (
                          <div className="flex flex-col gap-1 border-b border-slate-200/50 pb-3">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Descripción</span>
                            <span className="text-sm text-slate-700">{selectedRecord.descripcion}</span>
                          </div>
                        )}
                        {selectedRecord.detalles && typeof selectedRecord.detalles === 'object' && Object.entries(selectedRecord.detalles).map(([key, value]) => (
                          <div key={key} className="flex flex-col gap-1 border-b border-slate-200/50 last:border-0 pb-3 last:pb-0">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{key}</span>
                            <span className="text-sm text-slate-700">{String(value)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex gap-3">
                  <Button className="flex-1 bg-black text-white hover:bg-black/90 h-12 rounded-xl transition-all shadow-lg shadow-black/5 font-medium">
                    Compartir Ficha
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
    </div>
  );
}
