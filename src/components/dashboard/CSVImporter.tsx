import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileDown, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { importCSVInventory } from "@/lib/api/import.functions";
import { toast } from "sonner";
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";

export function CSVImporter() {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const queryClient = useQueryClient();

  const importMutation = useMutation({
    mutationFn: (data: any[]) => importCSVInventory({ data }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['supabase-inventory'] });
      if (res.success) {
        toast.success(`Importados ${res.count} productos con éxito`);
        setIsOpen(false);
        setFile(null);
      } else {
        toast.error(`Importación parcial: ${res.count} guardados, algunos errores ocurrieron.`);
      }
    },
    onError: (error) => {
      toast.error("Error crítico en la importación: " + error.message);
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    // Mapeo de columnas basado en el CSV del usuario
    // Nombre,Categoría,Imagen Original,Descripción,Foto Editada,Precio,Etiquetas...
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes('nombre'));
    const catIdx = headers.findIndex(h => h.toLowerCase().includes('categoría') || h.toLowerCase().includes('categoria'));
    const descIdx = headers.findIndex(h => h.toLowerCase().includes('descripción') || h.toLowerCase().includes('descripcion'));
    const imgIdx = headers.findIndex(h => h.toLowerCase().includes('foto editada') || h.toLowerCase().includes('imagen'));
    const priceIdx = headers.findIndex(h => h.toLowerCase().includes('precio'));

    const results = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const row = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
      if (!row || row.length === 0) continue;

      const clean = (val: string | undefined) => val?.trim().replace(/^"|"$/g, '') || "";
      
      const nombre = nameIdx !== -1 ? clean(row[nameIdx]) : "";
      if (!nombre) continue;

      let fotoUrl = imgIdx !== -1 ? clean(row[imgIdx]) : "";
      const urlMatch = fotoUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (urlMatch) {
        fotoUrl = urlMatch[1];
      }

      const precioStr = priceIdx !== -1 ? clean(row[priceIdx]).replace(/[^0-9.]/g, '') : "";
      const precio = precioStr ? parseFloat(precioStr) : 0;

      results.push({
        nombre,
        categoria: catIdx !== -1 ? clean(row[catIdx]) : "",
        descripcion: descIdx !== -1 ? clean(row[descIdx]) : "",
        precio,
        fotos: fotoUrl ? [{ url: fotoUrl }] : [],
        detalles: { source: 'csv_import' }
      });
    }
    return results;
  };

  const handleImport = async () => {
    if (!file) return;

    setIsParsing(true);
    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        toast.error("No se encontraron datos válidos en el CSV");
        setIsParsing(false);
        return;
      }

      toast.info(`Procesando ${data.length} registros...`);
      await importMutation.mutateAsync(data);
    } catch (err) {
      toast.error("Error al leer el archivo");
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="h-9 border-slate-200 text-slate-600"
        onClick={() => setIsOpen(true)}
      >
        <FileDown className="h-4 w-4 mr-2" />
        Importar CSV
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Importar desde CSV</DialogTitle>
            <DialogDescription>
              Selecciona el archivo "Total-Total.csv" para cargar el inventario automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 gap-4">
            <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
              <Upload className="h-6 w-6 text-slate-400" />
            </div>
            
            <div className="text-center">
              {file ? (
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="h-4 w-4" />
                  {file.name}
                </div>
              ) : (
                <span className="text-sm text-slate-500">Haz clic para subir o arrastra el archivo</span>
              )}
            </div>
            
            <input 
              type="file" 
              accept=".csv" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              onChange={handleFileChange}
              disabled={isParsing || importMutation.isPending}
            />
          </div>

          <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex gap-3">
            <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
            <p className="text-xs text-amber-700">
              El importador detectará automáticamente el Nombre, Categoría, Descripción, Fotos y Precios según las columnas del archivo.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isParsing || importMutation.isPending}>
              Cancelar
            </Button>
            <Button 
              className="bg-black text-white hover:bg-black/90" 
              onClick={handleImport}
              disabled={!file || isParsing || importMutation.isPending}
            >
              {(isParsing || importMutation.isPending) ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                "Comenzar Importación"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
