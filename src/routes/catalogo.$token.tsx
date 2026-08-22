import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CheckCircle2,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getPublicCatalogReview,
  submitCatalogReviewMark,
  type CatalogReviewProduct,
  type ReviewAction,
} from "@/lib/api/catalog-review";
import { getFirstDisplayImageUrl } from "@/lib/image-url";
import { CatalogReviewProductDialog } from "@/components/catalog/CatalogReviewProductDialog";
import { cn } from "@/lib/utils";
import { ClipboardCheck } from "lucide-react";

export const Route = createFileRoute("/catalogo/$token")({
  head: () => ({
    meta: [
      { title: "Catalogo Eleganzza | Revision" },
      {
        name: "description",
        content: "Marca cambios y comentarios sobre productos Eleganzza.",
      },
    ],
  }),
  component: PublicCatalogReviewPage,
});

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const actionConfig: Record<
  ReviewAction,
  { label: string; icon: typeof MessageSquareText; tone: string; helper: string }
> = {
  delete: {
    label: "Eliminar",
    icon: Trash2,
    tone: "border-red-200 text-red-700 hover:bg-red-50",
    helper: "Marca este producto para eliminarlo del catalogo.",
  },
  change_photo: {
    label: "Cambiar foto",
    icon: ImageIcon,
    tone: "border-blue-200 text-blue-700 hover:bg-blue-50",
    helper: "Indica que la foto no es correcta o debe reemplazarse.",
  },
  change_price: {
    label: "Cambiar precio",
    icon: DollarSign,
    tone: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    helper: "Puedes sugerir el precio correcto.",
  },
  note: {
    label: "Nota",
    icon: MessageSquareText,
    tone: "border-slate-200 text-slate-700 hover:bg-slate-50",
    helper: "Deja una observacion para este producto.",
  },
  other: {
    label: "Otro",
    icon: AlertCircle,
    tone: "border-amber-200 text-amber-700 hover:bg-amber-50",
    helper: "Usa esta opcion si el cambio no entra en las anteriores.",
  },
};

function productStatus(product: CatalogReviewProduct) {
  const status = product.detalles?.status;
  return typeof status === "string" ? status : "published";
}

function statusLabel(status: string) {
  if (status === "published") return "Publicado";
  if (status === "discontinued") return "Descontinuado";
  return "Borrador";
}

function PublicCatalogReviewPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [markFilter, setMarkFilter] = useState<"all" | "marked" | "pending">("all");
  const [reviewerName, setReviewerName] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogReviewProduct | null>(null);
  const [detailProductId, setDetailProductId] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<ReviewAction>("note");
  const [note, setNote] = useState("");
  const [suggestedPrice, setSuggestedPrice] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["public-catalog-review", token],
    queryFn: () => getPublicCatalogReview(token),
    retry: false,
  });

  const products = useMemo(() => data?.products || [], [data?.products]);

  const categories = useMemo(() => {
    return Array.from(new Set(products.map((product) => product.categoria).filter(Boolean))).sort(
      (a, b) => String(a).localeCompare(String(b), "es"),
    ) as string[];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.nombre.toLowerCase().includes(normalizedSearch) ||
        product.descripcion?.toLowerCase().includes(normalizedSearch) ||
        product.categoria?.toLowerCase().includes(normalizedSearch);
      const matchesCategory = categoryFilter === "all" || product.categoria === categoryFilter;
      const hasMarks = product.marks.length > 0;
      const matchesMark =
        markFilter === "all" ||
        (markFilter === "marked" && hasMarks) ||
        (markFilter === "pending" && !hasMarks);
      return matchesSearch && matchesCategory && matchesMark;
    });
  }, [products, searchTerm, categoryFilter, markFilter]);

  const submitMutation = useMutation({
    mutationFn: () => {
      if (!selectedProduct) throw new Error("Selecciona un producto");
      return submitCatalogReviewMark({
        token,
        productId: selectedProduct.id,
        action: selectedAction,
        note,
        suggestedPrice: selectedAction === "change_price" ? Number(suggestedPrice) || null : null,
        reviewerName,
      });
    },
    onSuccess: async () => {
      toast.success("Marca registrada. Gracias.");
      setSelectedProduct(null);
      setNote("");
      setSuggestedPrice("");
      await queryClient.invalidateQueries({ queryKey: ["public-catalog-review", token] });
    },
    onError: (submitError) => {
      toast.error(
        submitError instanceof Error ? submitError.message : "No fue posible registrar la marca",
      );
    },
  });

  const openAction = (product: CatalogReviewProduct, action: ReviewAction) => {
    setSelectedProduct(product);
    setSelectedAction(action);
    setNote("");
    setSuggestedPrice(product.precio ? String(product.precio) : "");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf7f3] text-slate-600">
        <div className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando catalogo
        </div>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#faf7f3] px-4">
        <div className="max-w-md rounded-lg border border-red-100 bg-white p-6 text-center shadow-sm">
          <AlertCircle className="mx-auto h-10 w-10 text-red-700" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950">Link no disponible</h1>
          <p className="mt-2 text-sm text-slate-500">
            Este enlace expiro, fue pausado o no existe. Solicita un nuevo link a Eleganzza.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf7f3] text-slate-950">
      <section className="border-b border-red-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-800">
                Eleganzza Muebles
              </p>
              <h1 className="mt-2 font-serif text-3xl font-semibold text-slate-950 md:text-5xl">
                {data.link.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                {data.link.intro_message ||
                  "Revisa los productos y marca cualquier cambio necesario."}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-[#faf7f3] px-4 py-3">
              <p className="text-xs font-semibold uppercase text-slate-500">Productos</p>
              <p className="font-serif text-3xl font-semibold">{filteredProducts.length}</p>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg border border-slate-200 bg-[#fcfbf8] p-3 md:grid-cols-[1fr_180px_180px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar producto, categoria o descripcion"
                className="bg-white pl-9"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="all">Categorias</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={markFilter}
              onChange={(event) => setMarkFilter(event.target.value as typeof markFilter)}
              className="h-10 rounded-md border border-input bg-white px-3 text-sm"
            >
              <option value="all">Todos</option>
              <option value="pending">Sin marcar</option>
              <option value="marked">Marcados</option>
            </select>
            <Input
              value={reviewerName}
              onChange={(event) => setReviewerName(event.target.value)}
              placeholder="Tu nombre (opcional)"
              className="bg-white"
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {filteredProducts.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
            <SlidersHorizontal className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm text-slate-500">No hay productos con esos filtros.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => {
              const imageUrl = getFirstDisplayImageUrl(product.galeria || product.fotos);
              const marked = product.marks.length > 0;

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="relative aspect-[4/3] bg-slate-100">
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt={product.nombre}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-300">
                        <ImageIcon className="h-12 w-12" />
                      </div>
                    )}
                    {marked ? (
                      <Badge className="absolute right-3 top-3 bg-emerald-600">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        Marcado
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-4 p-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        {product.categoria ? (
                          <Badge variant="secondary">{product.categoria}</Badge>
                        ) : null}
                        <Badge variant="outline">{statusLabel(productStatus(product))}</Badge>
                      </div>
                      <h2 className="mt-3 line-clamp-2 min-h-[3.5rem] font-serif text-2xl font-semibold">
                        {product.nombre}
                      </h2>
                      <p className="mt-1 text-lg font-semibold text-red-800">
                        {product.precio ? currency.format(product.precio) : "Sin precio"}
                      </p>
                      {product.descripcion ? (
                        <p className="mt-2 line-clamp-6 whitespace-pre-line text-base leading-7 text-slate-600">
                          {product.descripcion}
                        </p>
                      ) : null}
                    </div>

                    {marked ? (
                      <div className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        {product.marks.length} marca{product.marks.length === 1 ? "" : "s"}{" "}
                        registrada
                        {product.marks[0]?.note ? `: ${product.marks[0].note}` : "."}
                      </div>
                    ) : null}

                    <Button
                      className="w-full bg-red-800 text-white hover:bg-red-900"
                      onClick={() => setDetailProductId(product.id)}
                    >
                      <ClipboardCheck className="mr-2 h-4 w-4" />
                      Revisar ficha completa
                    </Button>

                    <div className="grid grid-cols-2 gap-2">
                      {(Object.keys(actionConfig) as ReviewAction[]).slice(0, 4).map((action) => {
                        const config = actionConfig[action];
                        const Icon = config.icon;
                        return (
                          <Button
                            key={action}
                            variant="outline"
                            size="sm"
                            className={cn("justify-start", config.tone)}
                            onClick={() => openAction(product, action)}
                          >
                            <Icon className="mr-2 h-4 w-4" />
                            {config.label}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(selectedProduct)}
        onOpenChange={(open) => !open && setSelectedProduct(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.nombre}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">
              {actionConfig[selectedAction].helper}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(actionConfig) as ReviewAction[]).map((action) => {
                const config = actionConfig[action];
                return (
                  <button
                    type="button"
                    key={action}
                    onClick={() => setSelectedAction(action)}
                    className={cn(
                      "rounded-md border px-3 py-2 text-left text-sm font-medium",
                      selectedAction === action
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600",
                    )}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>

            {selectedAction === "change_price" ? (
              <div className="space-y-2">
                <Label htmlFor="suggested-price">Precio sugerido</Label>
                <Input
                  id="suggested-price"
                  type="number"
                  min="0"
                  value={suggestedPrice}
                  onChange={(event) => setSuggestedPrice(event.target.value)}
                />
              </div>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="review-note">Nota para Eleganzza</Label>
              <Textarea
                id="review-note"
                rows={4}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Ej. Quitar esta foto, precio correcto 8,500, esta pieza ya no va..."
              />
            </div>

            <Button
              className="w-full bg-slate-900 text-white hover:bg-slate-800"
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Enviar marca
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <CatalogReviewProductDialog
        token={token}
        muebleId={detailProductId}
        reviewerName={reviewerName}
        onClose={() => setDetailProductId(null)}
      />
    </main>
  );
}
