import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RefreshCw, FileText, Camera, Layout, History, Wand2 } from "lucide-react";
import { SystemHealthPanel } from "@/components/dashboard/SystemHealthPanel";
import { WooCommerceIntegration } from "@/components/dashboard/WooCommerceIntegration";

const DEFAULT_PROMPTS = {
  copy: {
    system:
      "Eres un experto en marketing para una marca de muebles de lujo llamada Eleganzza Muebles. Crea textos persuasivos para redes sociales.",
    user: "Crea 3 opciones de copys (Instagram, Facebook y WhatsApp) para el producto: {nombre}. Categoría: {categoria}. Resalta la elegancia y confort.",
  },
  story: {
    system:
      "Eres un director creativo de marketing para Eleganzza Muebles. Diseña una estructura de stories visualmente impactante.",
    user: "Diseña una secuencia de 3 historias para el producto: {nombre}. Describe los elementos visuales, el texto en pantalla y el llamado a la acción.",
  },
  post: {
    system:
      "Eres un director creativo de marketing para Eleganzza Muebles. Diseña un post de feed estratégico.",
    user: "Describe detalladamente la composición visual, los colores y el copy principal para un post cuadrado de Instagram del producto: {nombre}.",
  },
  carousel: {
    system:
      "Eres un director creativo de marketing para Eleganzza Muebles. Diseña un carrusel educativo o de venta.",
    user: "Crea una estructura de 5 diapositivas para un carrusel sobre el producto: {nombre}. Indica qué va en cada slide (título, cuerpo, imagen sugerida).",
  },
  prompt: {
    system:
      "Eres un experto en ingeniería de prompts para IA generativa de imágenes (Midjourney/DALL-E).",
    user: "Genera un prompt técnico y detallado para crear una escena de estilo de vida de lujo (Luxury Lifestyle) donde el mueble {nombre} sea el protagonista. Incluye iluminación, materiales y ambiente.",
  },
};

export function PromptSettings() {
  const [prompts, setPrompts] = useState(DEFAULT_PROMPTS);

  useEffect(() => {
    const saved = localStorage.getItem("eleganzza_ai_prompts");
    if (saved) {
      try {
        setPrompts(JSON.parse(saved));
      } catch (e) {
        console.error("Error loading prompts from localStorage", e);
      }
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem("eleganzza_ai_prompts", JSON.stringify(prompts));
    toast.success("Configuración de prompts guardada localmente");
  };

  const handleReset = () => {
    if (
      confirm(
        "¿Estás seguro de que quieres restablecer todos los prompts a los valores predeterminados?",
      )
    ) {
      setPrompts(DEFAULT_PROMPTS);
      localStorage.setItem("eleganzza_ai_prompts", JSON.stringify(DEFAULT_PROMPTS));
      toast.success("Prompts restablecidos");
    }
  };

  const updatePrompt = (
    type: keyof typeof DEFAULT_PROMPTS,
    field: "system" | "user",
    value: string,
  ) => {
    setPrompts((prev) => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value,
      },
    }));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "copy":
        return <FileText className="h-4 w-4" />;
      case "story":
        return <Camera className="h-4 w-4" />;
      case "post":
        return <Layout className="h-4 w-4" />;
      case "carousel":
        return <History className="h-4 w-4" />;
      case "prompt":
        return <Wand2 className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-serif font-bold text-slate-900 dark:text-white">
            Configuración de Prompts IA
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            Personaliza cómo la inteligencia artificial genera tu contenido.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Restablecer
          </Button>
          <Button onClick={handleSave} className="bg-slate-900 text-white flex items-center gap-2">
            <Save className="h-4 w-4" /> Guardar Cambios
          </Button>
        </div>
      </div>

      <SystemHealthPanel />

      <WooCommerceIntegration />

      <div className="grid gap-8">
        {(Object.keys(prompts) as Array<keyof typeof DEFAULT_PROMPTS>).map((type) => (
          <Card key={type} className="border-slate-200">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600">
                  {getIcon(type)}
                </div>
                <div>
                  <CardTitle className="text-lg font-serif capitalize">
                    {type === "copy" ? "Marketing Copy" : type}
                  </CardTitle>
                  <CardDescription>
                    Configura las instrucciones para este tipo de contenido.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  System Prompt (Personalidad)
                </Label>
                <Textarea
                  value={prompts[type].system}
                  onChange={(e) => updatePrompt(type, "system", e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder="Instrucciones sobre el rol de la IA..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  User Prompt (Instrucción)
                </Label>
                <Textarea
                  value={prompts[type].user}
                  onChange={(e) => updatePrompt(type, "user", e.target.value)}
                  className="min-h-[120px] text-sm"
                  placeholder="Instrucciones específicas del contenido..."
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Usa variables como{" "}
                  <code className="bg-slate-100 px-1 rounded text-slate-600">{"{nombre}"}</code> y{" "}
                  <code className="bg-slate-100 px-1 rounded text-slate-600">{"{categoria}"}</code>{" "}
                  que se reemplazarán automáticamente.
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
