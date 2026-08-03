import React, { useState, useEffect } from "react";
import { 
  BookOpen, 
  Upload, 
  FileText, 
  Plus, 
  Loader2, 
  ExternalLink,
  ChevronRight,
  Image as ImageIcon,
  CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { getCatalogos, createCatalogo, extractProductsFromPDF } from "@/lib/api/catalogos.functions";
import { uploadToDrive } from "@/lib/api/inventory.functions";
import { useServerFn } from "@tanstack/react-start";

export function CatalogosManager() {
  const [catalogos, setCatalogos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [nombre, setNombre] = useState("");

  const fetchCatalogos = async () => {
    try {
      const data = await getCatalogos();
      setCatalogos(data);
    } catch (error) {
      console.error(error);
      toast.error("Error al cargar catálogos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogos();
  }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !nombre) {
      toast.error("Selecciona un PDF e ingresa un nombre");
      return;
    }

    setUploading(true);
    try {
      // 1. Convertir a base64 para subir
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

      const base64 = await fileToBase64(selectedFile);
      const folderId = "0AKMhdlaXwPtQUk9PVA"; // ID proporcionado por el usuario
      
      const driveFile = await uploadToDrive({ 
        data: { 
          fileName: `${nombre}.pdf`,
          mimeType: "application/pdf",
          base64,
          folderId,
        } 
      });

      // 2. Guardar en Supabase
      await createCatalogo({
        data: {
          nombre,
          pdf_url: driveFile.url || "",
          drive_folder_id: folderId
        }
      });

      toast.success("Catálogo subido correctamente");
      setNombre("");
      setSelectedFile(null);
      fetchCatalogos();
    } catch (error) {
      console.error(error);
      toast.error("Error al subir el catálogo");
    } finally {
      setUploading(false);
    }
  };

  const handleExtract = async (id: string, url: string) => {
    toast.info("Iniciando extracción de productos con IA...");
    try {
      await extractProductsFromPDF({ data: { catalogoId: id, pdfUrl: url } });
      toast.success("El proceso ha iniciado. Los productos aparecerán pronto en el inventario.");
    } catch (error) {
      toast.error("Error al iniciar la extracción");
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Formulario de Carga */}
        <div className="md:col-span-1 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Upload className="h-5 w-5 text-blue-500" />
            Subir Nuevo Catálogo
          </h3>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Nombre del Catálogo</label>
              <Input 
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Catálogo Verano 2026"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Archivo PDF</label>
              <Input 
                type="file" 
                accept=".pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="mt-1 cursor-pointer"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Subiendo...
                </>
              ) : (
                "Subir y Vincular"
              )}
            </Button>
          </form>
        </div>

        {/* Lista de Catálogos */}
        <div className="md:col-span-2 space-y-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-500" />
            Catálogos Disponibles
          </h3>
          
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
          ) : catalogos.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
              <FileText className="h-12 w-12 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-500">No hay catálogos subidos aún.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {catalogos.map((cat) => (
                <div 
                  key={cat.id}
                  className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-red-50 dark:bg-red-900/20 rounded flex items-center justify-center">
                      <FileText className="h-6 w-6 text-red-500" />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900 dark:text-white">{cat.nombre}</h4>
                      <p className="text-xs text-slate-500">Subido el {new Date(cat.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => window.open(cat.pdf_url, "_blank")}
                      className="gap-2"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver PDF
                    </Button>
                    <Button 
                      variant="default" 
                      size="sm"
                      onClick={() => handleExtract(cat.id, cat.pdf_url)}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Generar Productos
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Explicación del Proceso */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-100 dark:border-blue-800">
        <h4 className="text-blue-800 dark:text-blue-300 font-semibold mb-4 flex items-center gap-2">
          <ImageIcon className="h-5 w-5" />
          ¿Cómo funciona el Generador de Muebles?
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200 shrink-0">1</div>
            <p className="text-sm text-blue-700 dark:text-blue-400">Subes el catálogo en PDF de Eleganzza a tu unidad compartida de Drive.</p>
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200 shrink-0">2</div>
            <p className="text-sm text-blue-700 dark:text-blue-400">Nuestra IA analiza cada página buscando muebles, precios y descripciones.</p>
          </div>
          <div className="flex gap-3">
            <div className="h-6 w-6 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200 shrink-0">3</div>
            <p className="text-sm text-blue-700 dark:text-blue-400">Se crean automáticamente los productos en el inventario con sus respectivas fotos extraídas.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
