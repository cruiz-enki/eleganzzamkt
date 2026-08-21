import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Link2,
  Loader2,
  MessageSquareText,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getSupabaseInventory } from "@/lib/api/inventory.functions";
import {
  createCatalogReviewLink,
  getCatalogReviewLinks,
  getCatalogReviewMarks,
  updateCatalogReviewLinkStatus,
  type CatalogReviewFilters,
  type CatalogReviewLink,
} from "@/lib/api/catalog-review";
import { cn } from "@/lib/utils";

const statusOptions = [
  { value: "draft", label: "Borrador" },
  { value: "published", label: "Publicado" },
  { value: "discontinued", label: "Descontinuado" },
];

const actionLabels: Record<string, string> = {
  delete: "Eliminar",
  change_photo: "Cambiar foto",
  change_price: "Cambiar precio",
  note: "Nota",
  other: "Otro",
};

type ReviewMarkListItem = {
  id: string;
  requested_action: string;
  note: string | null;
  muebles?: {
    nombre?: string | null;
  } | null;
  catalog_review_links?: {
    client_name?: string | null;
  } | null;
};

function reviewUrl(token: string) {
  const origin =
    typeof window === "undefined" ? "https://eleganzzamkt.enkidad.com" : window.location.origin;
  return `${origin}/catalogo/${token}`;
}

function productStatus(detalles: unknown) {
  if (detalles && typeof detalles === "object" && "status" in detalles) {
    const status = (detalles as { status?: unknown }).status;
    if (typeof status === "string") return status;
  }
  return "published";
}

export function CatalogReviewLinksManager() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("Catalogo para revision");
  const [clientName, setClientName] = useState("");
  const [introMessage, setIntroMessage] = useState(
    "Marca los productos que quieras ajustar. Puedes pedir cambio de foto, precio, eliminacion o dejar una nota.",
  );
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["draft", "published"]);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ["supabase-inventory"],
    queryFn: () => getSupabaseInventory(),
  });

  const { data: links = [], isLoading: isLoadingLinks } = useQuery({
    queryKey: ["catalog-review-links"],
    queryFn: () => getCatalogReviewLinks("catalogo"),
  });

  const { data: marks = [], isLoading: isLoadingMarks } = useQuery({
    queryKey: ["catalog-review-marks"],
    queryFn: () => getCatalogReviewMarks(),
  });

  const categories = useMemo(() => {
    return Array.from(
      new Set(products.map((product) => product.categoria).filter(Boolean) as string[]),
    ).sort((a, b) => a.localeCompare(b, "es"));
  }, [products]);

  const previewCount = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedCategories.length === 0 ||
        (product.categoria ? selectedCategories.includes(product.categoria) : false);
      const matchesStatus =
        selectedStatuses.length === 0 || selectedStatuses.includes(productStatus(product.detalles));
      return matchesCategory && matchesStatus;
    }).length;
  }, [products, selectedCategories, selectedStatuses]);

  const createMutation = useMutation({
    mutationFn: () => {
      const filters: CatalogReviewFilters = {
        categories: selectedCategories,
        statuses: selectedStatuses,
      };

      return createCatalogReviewLink({
        title,
        clientName,
        introMessage,
        filters,
      });
    },
    onSuccess: async (link) => {
      await queryClient.invalidateQueries({ queryKey: ["catalog-review-links"] });
      toast.success("Link de catalogo generado");
      await copyLink(link);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No fue posible crear el link");
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      updateCatalogReviewLinkStatus(id, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalog-review-links"] });
      toast.success("Estado del link actualizado");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "No fue posible actualizar el link");
    },
  });

  const toggleValue = (value: string, values: string[], setValues: (next: string[]) => void) => {
    setValues(
      values.includes(value) ? values.filter((item) => item !== value) : [...values, value],
    );
  };

  const copyLink = async (link: CatalogReviewLink) => {
    const url = reviewUrl(link.token);
    await navigator.clipboard.writeText(url);
    setCopiedToken(link.token);
    window.setTimeout(() => setCopiedToken(null), 1600);
    toast.success("Link copiado");
  };

  return (
    <section className="space-y-6 rounded-xl border border-red-100 bg-red-50/40 p-5 dark:border-red-950/50 dark:bg-red-950/10">
      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
            <Link2 className="h-5 w-5 text-red-700" />
            Links de catalogo para clientes
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Comparte un link publico para que el cliente marque cambios sin entrar al panel.
          </p>
        </div>
        <Badge variant="outline" className="w-fit border-red-200 bg-white text-red-700">
          {previewCount} productos en el link
        </Badge>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="review-title">Nombre del link</Label>
              <Input
                id="review-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="review-client">Cliente</Label>
              <Input
                id="review-client"
                value={clientName}
                placeholder="Ej. Laura / Hotel Centro"
                onChange={(event) => setClientName(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="review-message">Mensaje inicial</Label>
            <Textarea
              id="review-message"
              value={introMessage}
              onChange={(event) => setIntroMessage(event.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <Filter className="h-4 w-4" />
                Categorias
              </div>
              <div className="flex flex-wrap gap-2">
                {isLoadingProducts ? (
                  <span className="text-sm text-slate-400">Cargando categorias...</span>
                ) : categories.length === 0 ? (
                  <span className="text-sm text-slate-400">Sin categorias</span>
                ) : (
                  categories.map((category) => (
                    <button
                      type="button"
                      key={category}
                      onClick={() =>
                        toggleValue(category, selectedCategories, setSelectedCategories)
                      }
                      className={cn(
                        "rounded-md border px-3 py-1.5 text-sm transition-colors",
                        selectedCategories.includes(category)
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
                      )}
                    >
                      {category}
                    </button>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-400">Sin seleccion muestra todas las categorias.</p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
                <SlidersHorizontal className="h-4 w-4" />
                Estados
              </div>
              <div className="space-y-2">
                {statusOptions.map((option) => (
                  <label key={option.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedStatuses.includes(option.value)}
                      onCheckedChange={() =>
                        toggleValue(option.value, selectedStatuses, setSelectedStatuses)
                      }
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <Button
            className="w-full bg-slate-900 text-white hover:bg-slate-800"
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !title.trim()}
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-2 h-4 w-4" />
            )}
            Generar link y copiar
          </Button>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
              Solicitudes recientes
            </h4>
            <Badge variant="secondary">{marks.length}</Badge>
          </div>
          {isLoadingMarks ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando marcas
            </div>
          ) : marks.length === 0 ? (
            <p className="text-sm text-slate-500">Todavia no hay marcas de clientes.</p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {(marks as ReviewMarkListItem[]).slice(0, 8).map((mark) => (
                <div key={mark.id} className="rounded-md border border-slate-100 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-slate-900">{mark.muebles?.nombre}</p>
                      <p className="text-xs text-slate-500">
                        {actionLabels[mark.requested_action] || mark.requested_action}
                        {mark.catalog_review_links?.client_name
                          ? ` · ${mark.catalog_review_links.client_name}`
                          : ""}
                      </p>
                    </div>
                    <MessageSquareText className="h-4 w-4 text-slate-300" />
                  </div>
                  {mark.note ? <p className="mt-2 text-xs text-slate-600">{mark.note}</p> : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Links generados</h4>
        {isLoadingLinks ? (
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando links
          </div>
        ) : links.length === 0 ? (
          <p className="text-sm text-slate-500">Aun no has generado links de revision.</p>
        ) : (
          <div className="grid gap-3">
            {links.map((link) => (
              <div
                key={link.id}
                className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-900 dark:text-white">{link.title}</p>
                    <Badge variant={link.is_active ? "default" : "secondary"}>
                      {link.is_active ? "Activo" : "Pausado"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {link.client_name || "Sin cliente"} · Creado{" "}
                    {new Date(link.created_at).toLocaleDateString()}
                    {link.last_viewed_at
                      ? ` · Visto ${new Date(link.last_viewed_at).toLocaleDateString()}`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => copyLink(link)}>
                    {copiedToken === link.token ? (
                      <Check className="mr-2 h-4 w-4" />
                    ) : (
                      <Copy className="mr-2 h-4 w-4" />
                    )}
                    Copiar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(reviewUrl(link.token), "_blank")}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Abrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      statusMutation.mutate({ id: link.id, isActive: !link.is_active })
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    {link.is_active ? "Pausar" : "Activar"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
