import { useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Pencil,
  Send,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  addCatalogReviewComment,
  getCatalogReviewProduct,
  setCatalogAssetDecision,
  setCatalogReviewVerification,
  type CatalogReviewAsset,
} from "@/lib/api/catalog-review";
import { uploadCatalogReviewPhoto } from "@/lib/api/catalog-review.functions";
import { getDisplayImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

const REAL_TYPES = ["foto_real", "original"];
const AI_TYPES = ["editada", "ia"];

function assetImageUrl(asset: CatalogReviewAsset): string {
  return getDisplayImageUrl({ id: asset.drive_file_id ?? undefined, url: asset.url ?? undefined });
}

const assetStateBadge: Record<string, { label: string; cls: string }> = {
  aprobada: { label: "Aprobada", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rechazada: { label: "Rechazada", cls: "bg-red-100 text-red-700 border-red-200" },
  cambios_solicitados: { label: "Cambios", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  pendiente: { label: "Pendiente", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

export function CatalogReviewProductDialog({
  token,
  muebleId,
  reviewerName,
  onClose,
}: {
  token: string;
  muebleId: string | null;
  reviewerName: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [comment, setComment] = useState("");

  const { data: product, isLoading } = useQuery({
    queryKey: ["catalog-review-product", token, muebleId],
    queryFn: () => getCatalogReviewProduct(token, muebleId as string),
    enabled: Boolean(muebleId),
    retry: false,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["catalog-review-product", token, muebleId] });
    await queryClient.invalidateQueries({ queryKey: ["public-catalog-review", token] });
  };

  const verifyMutation = useMutation({
    mutationFn: (estado: "verificado" | "rechazado") =>
      setCatalogReviewVerification({ token, muebleId: muebleId as string, estado, reviewerName }),
    onSuccess: async (_r, estado) => {
      toast.success(estado === "verificado" ? "Producto verificado." : "Producto rechazado.");
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No fue posible registrar."),
  });

  const assetMutation = useMutation({
    mutationFn: (input: {
      assetId: string;
      decision: "aprobada" | "rechazada" | "cambios_solicitados";
    }) =>
      setCatalogAssetDecision({
        token,
        assetId: input.assetId,
        decision: input.decision,
        reviewerName,
      }),
    onSuccess: async () => {
      toast.success("Decisión registrada.");
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No fue posible registrar."),
  });

  const commentMutation = useMutation({
    mutationFn: () =>
      addCatalogReviewComment({ token, muebleId: muebleId as string, autor: reviewerName, mensaje: comment }),
    onSuccess: async () => {
      toast.success("Comentario enviado.");
      setComment("");
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No fue posible comentar."),
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      const payload = [];
      for (const file of Array.from(files).slice(0, 10)) {
        payload.push({ fileName: file.name, mimeType: file.type, base64: await fileToBase64(file) });
      }
      return uploadCatalogReviewPhoto({
        data: { token, muebleId: muebleId as string, reviewerName, files: payload },
      });
    },
    onSuccess: async (r) => {
      toast.success(`${r.count} foto(s) subida(s).`);
      await refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No fue posible subir."),
  });

  const groups = useMemo(() => {
    const assets = product?.assets ?? [];
    return {
      reales: assets.filter((a) => REAL_TYPES.includes(a.tipo)),
      ia: assets.filter((a) => AI_TYPES.includes(a.tipo)),
      otras: assets.filter((a) => !REAL_TYPES.includes(a.tipo) && !AI_TYPES.includes(a.tipo)),
    };
  }, [product]);

  const legacyImages = useMemo(() => {
    if (!product) return [] as string[];
    const raw = [...(product.galeria ?? []), ...(product.fotos ?? [])];
    return raw.map((x) => getDisplayImageUrl(x as never)).filter(Boolean);
  }, [product]);

  const compare = useMemo(() => {
    const original = groups.reales[0] ?? null;
    const generated = groups.ia[0] ?? null;
    return original && generated ? { original, generated } : null;
  }, [groups]);

  const busy = verifyMutation.isPending || assetMutation.isPending;

  return (
    <Dialog open={Boolean(muebleId)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl p-0">
        <ScrollArea className="max-h-[88vh]">
          <div className="p-5 sm:p-6">
            {isLoading || !product ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando ficha…
              </div>
            ) : (
              <>
                <DialogHeader className="text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    {product.categoria ? <Badge variant="secondary">{product.categoria}</Badge> : null}
                    {product.sku ? (
                      <span className="text-xs font-mono text-slate-400">{product.sku}</span>
                    ) : null}
                    <VerificationBadge estado={product.estado_verificacion} />
                  </div>
                  <DialogTitle className="mt-2 font-serif text-2xl">{product.nombre}</DialogTitle>
                  <p className="text-lg font-semibold text-red-800">
                    {product.precio ? currency.format(product.precio) : "Sin precio"}
                  </p>
                </DialogHeader>

                {/* Verificación del producto */}
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="h-12 flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={busy}
                    onClick={() => verifyMutation.mutate("verificado")}
                  >
                    <ShieldCheck className="mr-2 h-5 w-5" /> Marcar verificado
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 flex-1 border-red-200 text-red-700 hover:bg-red-50"
                    disabled={busy}
                    onClick={() => verifyMutation.mutate("rechazado")}
                  >
                    <X className="mr-2 h-5 w-5" /> Rechazar producto
                  </Button>
                </div>

                {/* Comparación original vs IA */}
                {compare ? (
                  <div className="mt-6">
                    <SectionTitle icon={BadgeCheck}>Comparar: real vs generada</SectionTitle>
                    <div className="mt-2 grid grid-cols-2 gap-3">
                      <figure>
                        <img
                          src={assetImageUrl(compare.original)}
                          alt="Original"
                          className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                        />
                        <figcaption className="mt-1 text-center text-xs font-semibold text-slate-500">
                          REAL / ORIGINAL
                        </figcaption>
                      </figure>
                      <figure>
                        <img
                          src={assetImageUrl(compare.generated)}
                          alt="Generada"
                          className="aspect-square w-full rounded-lg border border-slate-200 object-cover"
                        />
                        <figcaption className="mt-1 text-center text-xs font-semibold text-slate-500">
                          EDITADA / IA
                        </figcaption>
                      </figure>
                    </div>
                  </div>
                ) : null}

                {/* Grupos de assets */}
                <AssetGroup
                  title="Fotos reales / originales"
                  assets={groups.reales}
                  onDecision={(assetId, decision) => assetMutation.mutate({ assetId, decision })}
                  busy={busy}
                />
                <AssetGroup
                  title="Editadas / IA"
                  assets={groups.ia}
                  onDecision={(assetId, decision) => assetMutation.mutate({ assetId, decision })}
                  busy={busy}
                />
                <AssetGroup
                  title="Otras"
                  assets={groups.otras}
                  onDecision={(assetId, decision) => assetMutation.mutate({ assetId, decision })}
                  busy={busy}
                />

                {/* Imágenes legado (catálogo actual, sin tracking) */}
                {product.assets.length === 0 && legacyImages.length > 0 ? (
                  <div className="mt-6">
                    <SectionTitle icon={ImageIcon}>Catálogo actual</SectionTitle>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      {legacyImages.slice(0, 9).map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="aspect-square w-full rounded-md border border-slate-200 object-cover"
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      Estas imágenes aún no están clasificadas como assets rastreados.
                    </p>
                  </div>
                ) : null}

                {/* Subir fotos reales */}
                <div className="mt-6">
                  <SectionTitle icon={Upload}>Subir fotos reales</SectionTitle>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.length) uploadMutation.mutate(e.target.files);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    variant="outline"
                    className="mt-2 h-12 w-full border-dashed border-slate-300"
                    disabled={uploadMutation.isPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadMutation.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Tomar / subir fotos reales (JPG, PNG, WEBP)
                  </Button>
                </div>

                {/* Comentarios */}
                <div className="mt-6">
                  <SectionTitle icon={MessageSquareText}>Comentarios</SectionTitle>
                  <div className="mt-2 space-y-2">
                    {product.comments.length === 0 ? (
                      <p className="text-sm text-slate-400">Aún no hay comentarios.</p>
                    ) : (
                      product.comments.map((c) => (
                        <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <p className="text-slate-700">{c.mensaje}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {c.autor || "Eleganzza"} · {new Date(c.created_at).toLocaleString("es-MX")}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <Textarea
                      rows={2}
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Escribe un comentario para Eleganzza…"
                      className="flex-1"
                    />
                    <Button
                      className="h-auto bg-slate-900 text-white hover:bg-slate-800 sm:self-stretch"
                      disabled={commentMutation.isPending || !comment.trim()}
                      onClick={() => commentMutation.mutate()}
                    >
                      {commentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function VerificationBadge({ estado }: { estado: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    verificado: { label: "Verificado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
    rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-700 border-red-200" },
    por_verificar: { label: "Por verificar", cls: "bg-amber-100 text-amber-700 border-amber-200" },
    incompleto: { label: "Incompleto", cls: "bg-slate-100 text-slate-600 border-slate-200" },
  };
  const v = map[estado] ?? map["por_verificar"];
  return <Badge variant="outline" className={cn("border", v!.cls)}>{v!.label}</Badge>;
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Check; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </h3>
  );
}

function AssetGroup({
  title,
  assets,
  onDecision,
  busy,
}: {
  title: string;
  assets: CatalogReviewAsset[];
  onDecision: (assetId: string, decision: "aprobada" | "rechazada" | "cambios_solicitados") => void;
  busy: boolean;
}) {
  if (assets.length === 0) return null;
  return (
    <div className="mt-6">
      <SectionTitle icon={ImageIcon}>{title}</SectionTitle>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {assets.map((asset) => {
          const badge = assetStateBadge[asset.estado_revision] ?? assetStateBadge["pendiente"];
          return (
            <div key={asset.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div className="relative aspect-square bg-slate-100">
                <img src={assetImageUrl(asset)} alt="" className="h-full w-full object-cover" />
                <Badge variant="outline" className={cn("absolute left-2 top-2 border", badge!.cls)}>
                  {badge!.label}
                </Badge>
              </div>
              <div className="grid grid-cols-3 gap-1 p-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  disabled={busy}
                  onClick={() => onDecision(asset.id, "aprobada")}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-amber-200 text-amber-700 hover:bg-amber-50"
                  disabled={busy}
                  onClick={() => onDecision(asset.id, "cambios_solicitados")}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50"
                  disabled={busy}
                  onClick={() => onDecision(asset.id, "rechazada")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
