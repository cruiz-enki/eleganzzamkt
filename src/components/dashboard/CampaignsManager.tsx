import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getCampaigns, upsertCampaign, deleteCampaign, Campaign } from "@/lib/api/campaigns.functions";
import { uploadToDrive } from "@/lib/api/inventory.functions";
import { 
  Plus, 
  ExternalLink, 
  MoreVertical, 
  Trash2, 
  Edit2, 
  Calendar, 
  Megaphone,
  Upload,
  Link as LinkIcon,
  X,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CampaignsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Partial<Campaign> | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: campaigns = [], isLoading, error } = useQuery({
    queryKey: ['campaigns'],
    queryFn: () => getCampaigns(),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: any) => upsertCampaign({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      setIsDialogOpen(false);
      setEditingCampaign(null);
      toast.success(editingCampaign?.id ? "Campaña actualizada" : "Campaña creada");
    },
    onError: (err: any) => {
      toast.error("Error al guardar: " + err.message);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCampaign({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success("Campaña eliminada");
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const uploadedFiles: any[] = [...(editingCampaign?.artes_oficiales || [])];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue;

        const reader = new FileReader();
        
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const result = reader.result;
            if (typeof result === 'string') {
              resolve(result.split(',')[1]);
            } else {
              reject(new Error("Error al leer el archivo"));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const base64 = await base64Promise;
        const uploaded = await uploadToDrive({
          data: {
            fileName: file.name,
            mimeType: file.type,
            base64: base64,
          }
        });
        
        uploadedFiles.push({
          id: uploaded.id,
          url: uploaded.url,
          name: file.name
        });
      }

      setEditingCampaign(prev => ({ ...prev, artes_oficiales: uploadedFiles }));
      toast.success("Archivos subidos con éxito");
    } catch (err: any) {
      toast.error("Error al subir archivos: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...(editingCampaign?.artes_oficiales || [])];
    newFiles.splice(index, 1);
    setEditingCampaign(prev => ({ ...prev, artes_oficiales: newFiles }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign?.nombre) {
      toast.error("El nombre es obligatorio");
      return;
    }
    upsertMutation.mutate(editingCampaign);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-slate-300" /></div>;

  if (error && campaigns.length === 0) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-lg border border-amber-200">
        <p className="text-amber-700 font-medium">Error de conexión con la base de datos.</p>
        <p className="text-sm text-amber-600 mt-2">Asegúrate de haber creado la tabla 'campanas' en tu Supabase.</p>
        <div className="mt-4 p-4 bg-white rounded border border-amber-100 text-left overflow-auto text-xs font-mono">
          {`CREATE TABLE public.campanas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  descripcion text,
  canva_link text,
  artes_oficiales jsonb default '[]'::jsonb,
  fecha_inicio date,
  fecha_fin date,
  detalles jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now()
);
GRANT ALL ON public.campanas TO authenticated, anon, service_role;`}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900">Gestión de Campañas</h2>
          <p className="text-slate-500">Administra tus campañas estacionales y artes oficiales.</p>
        </div>
        <Button onClick={() => { setEditingCampaign({}); setIsDialogOpen(true); }} className="bg-slate-900">
          <Plus className="h-4 w-4 mr-2" /> Nueva Campaña
        </Button>
      </div>

      {campaigns.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
            <Megaphone className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-slate-900">No hay campañas registradas</h3>
          <p className="text-slate-500 mt-1 max-w-xs mx-auto text-sm">Comienza creando tu primera campaña para organizar tus contenidos.</p>
          <Button variant="outline" onClick={() => { setEditingCampaign({}); setIsDialogOpen(true); }} className="mt-6">
            Crear ahora
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} className="overflow-hidden border-slate-200 group hover:border-slate-300 transition-all">
              <CardHeader className="pb-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-indigo-50 rounded-lg">
                    <Megaphone className="h-5 w-5 text-indigo-600" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { setEditingCampaign(campaign); setIsDialogOpen(true); }}>
                        <Edit2 className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => deleteMutation.mutate(campaign.id)}>
                        <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <CardTitle className="mt-4 text-xl font-serif">{campaign.nombre}</CardTitle>
                {(campaign.fecha_inicio || campaign.fecha_fin) && (
                  <div className="flex items-center text-xs text-slate-500 mt-1">
                    <Calendar className="h-3 w-3 mr-1" />
                    {campaign.fecha_inicio} {campaign.fecha_fin ? `- ${campaign.fecha_fin}` : ''}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 line-clamp-3 mb-4 h-15">
                  {campaign.descripcion || "Sin descripción."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {campaign.canva_link && (
                    <a 
                      href={campaign.canva_link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors"
                    >
                      <LinkIcon className="h-3 w-3 mr-1" /> Canva
                    </a>
                  )}
                  {campaign.artes_oficiales && campaign.artes_oficiales.length > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                      {campaign.artes_oficiales.length} Artes
                    </span>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-2 flex gap-2">
                <Button variant="outline" className="flex-1 text-xs h-9" onClick={() => { setEditingCampaign(campaign); setIsDialogOpen(true); }}>
                  Ver detalles
                </Button>
                {campaign.canva_link && (
                  <Button variant="outline" size="icon" className="h-9 w-9 text-slate-400" asChild>
                    <a href={campaign.canva_link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-serif">
              {editingCampaign?.id ? "Editar Campaña" : "Nueva Campaña"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nombre">Nombre de la Campaña</Label>
                <Input 
                  id="nombre" 
                  placeholder="Ej: Verano 2026, Buen Fin..." 
                  value={editingCampaign?.nombre || ''} 
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, nombre: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="fecha_inicio">Fecha Inicio</Label>
                  <Input 
                    id="fecha_inicio" 
                    type="date"
                    value={editingCampaign?.fecha_inicio || ''} 
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, fecha_inicio: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="fecha_fin">Fecha Fin</Label>
                  <Input 
                    id="fecha_fin" 
                    type="date"
                    value={editingCampaign?.fecha_fin || ''} 
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, fecha_fin: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea 
                  id="descripcion" 
                  placeholder="Explica el objetivo de la campaña..." 
                  className="min-h-[100px]"
                  value={editingCampaign?.descripcion || ''} 
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, descripcion: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="canva_link">Enlace de Canva</Label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    id="canva_link" 
                    placeholder="https://www.canva.com/..." 
                    className="pl-9"
                    value={editingCampaign?.canva_link || ''} 
                    onChange={(e) => setEditingCampaign({ ...editingCampaign, canva_link: e.target.value })}
                  />
                </div>
              </div>
              
              <div className="grid gap-3">
                <Label>Artes Oficiales Aprobados</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {editingCampaign?.artes_oficiales?.map((file, idx) => (
                    <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={file.url} alt={file.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => removeFile(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <label className="border-2 border-dashed border-slate-200 rounded-lg aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all">
                    {isUploading ? (
                      <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-slate-400 mb-1" />
                        <span className="text-[10px] text-slate-500 font-medium">Subir Arte</span>
                      </>
                    )}
                    <input type="file" multiple className="hidden" onChange={handleFileUpload} disabled={isUploading} accept="image/*" />
                  </label>
                </div>
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-white pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={upsertMutation.isPending || isUploading} className="bg-slate-900">
                {upsertMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Guardar Campaña
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
