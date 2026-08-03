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
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const parseCSV = (text: string) => {
    // Intentar normalizar saltos de línea y manejar campos complejos
    const lines = text.split(/\r?\n/);
    if (lines.length < 2) return [];

    const firstLine = lines[0];
    if (!firstLine) return [];
    
    const headers = firstLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    const nameIdx = headers.findIndex(h => h.toLowerCase().includes('nombre'));
    const catIdx = headers.findIndex(h => h.toLowerCase().includes('categoría') || h.toLowerCase().includes('categoria'));
    const descIdx = headers.findIndex(h => h.toLowerCase().includes('descripción') || h.toLowerCase().includes('descripcion'));
    const imgIdx = headers.findIndex(h => h.toLowerCase().includes('foto editada') || h.toLowerCase().includes('imagen'));
    const priceIdx = headers.findIndex(h => h.toLowerCase().includes('precio'));

    const results = [];
    for (let i = 1; i < lines.length; i++) {
      let line = lines[i] || "";
      if (!line.trim()) continue;
      
      const row: string[] = [];
      let currentField = "";
      let inQuotes = false;
      
      // Función para procesar caracteres de una línea y manejar comillas
      const processLineChars = (str: string) => {
        for (let j = 0; j < str.length; j++) {
          const char = str[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            row.push(currentField.trim());
            currentField = "";
          } else {
            currentField += char;
          }
        }
      };

      processLineChars(line);

      // Si terminamos la línea pero seguimos dentro de comillas, es un campo multi-línea
      while (inQuotes && i + 1 < lines.length) {
        i++;
        currentField += "\n";
        line = lines[i] || "";
        processLineChars(line);
      }
      
      row.push(currentField.trim());

      const clean = (val: string | undefined) => val?.replace(/^"|"$/g, '').trim() || "";
      
      const nombre = nameIdx !== -1 && row[nameIdx] !== undefined ? clean(row[nameIdx]) : "";
      if (!nombre) continue;

      let fotoUrl = imgIdx !== -1 && row[imgIdx] !== undefined ? clean(row[imgIdx]) : "";
      const urlMatch = fotoUrl.match(/\((https?:\/\/[^\)]+)\)/);
      if (urlMatch) {
        fotoUrl = urlMatch[1] ?? "";
      }

      const precioStr = priceIdx !== -1 && row[priceIdx] !== undefined ? clean(row[priceIdx]).replace(/[^0-9.]/g, '') : "";
      let precio = precioStr ? parseFloat(precioStr) : 0;
      if (isNaN(precio)) precio = 0;

      results.push({
        nombre,
        categoria: catIdx !== -1 && row[catIdx] !== undefined ? clean(row[catIdx]) : "",
        descripcion: descIdx !== -1 && row[descIdx] !== undefined ? clean(row[descIdx]) : "",
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
        className="h-9 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400"
        onClick={() => setIsOpen(true)}
      >
        <FileDown className="h-4 w-4 mr-2" />
        Importar CSV
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Importar desde CSV</DialogTitle>
            <DialogDescription>
              Selecciona el archivo "Total-Total.csv" para cargar el inventario automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-800/50 gap-4 relative">
            <div className="w-12 h-12 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center shadow-sm">
              <Upload className="h-6 w-6 text-slate-400 dark:text-slate-500" />
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

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 p-3 rounded-lg flex flex-col gap-2">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                El importador detectará automáticamente el Nombre, Categoría, Descripción, Fotos y Precios.
              </p>
            </div>
            <p className="text-[10px] text-amber-600 font-medium italic pl-8">
              Nota: Al importar, se creará automáticamente una carpeta en Drive para cada producto y se almacenarán sus imágenes.
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
