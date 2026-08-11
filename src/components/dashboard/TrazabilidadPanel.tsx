import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Check,
  ImageIcon,
  Layers,
  Loader2,
  RefreshCcw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getSupabaseInventory, type Mueble } from "@/lib/api/inventory.functions";
import {
  backfillMuebleAssets,
  getCatalogTraceabilityStats,
  getMuebleTraceability,
  setAssetReviewDecision,
  type MuebleAsset,
} from "@/lib/api/traceability";
import { getDisplayImageUrl } from "@/lib/image-url";
import { cn } from "@/lib/utils";

const currency = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" });

type VerFilter = "all" | "verificado" | "por_verificar" | "rechazado" | "incompleto";

const verBadge: Record<string, { label: string; cls: string }> = {
  verificado: { label: "Verificado", cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  rechazado: { label: "Rechazado", cls: "bg-red-100 text-red-700 border-red-200" },
  por_verificar: { label: "Por verificar", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  incompleto: { label: "Incompleto", cls: "bg-slate-100 text-slate-600 border-slate-200" },
};

function verOf(m: Mueble): string {
  return (m as unknown as { estado_verificacion?: string }).estado_verificacion ?? "por_verificar";
}

export function TrazabilidadPanel() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<VerFilter>("all");
  const [detailId, setDetailId] = useState<string | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["trace-stats"],
    queryFn: getCatalogTraceabilityStats,
  });
  const { data: muebles } = useQuery({
    queryKey: ["supabase-inventory"],
    queryFn: () => getSupabaseInventory(),
  });

  const backfill = useMutation({
    mutationFn: backfillMuebleAssets,
    onSuccess: async (r) => {
      toast.success(`${r.inserted} imágenes vinculadas en ${r.productos} productos.`);
      await queryClient.invalidateQueries({ queryKey: ["trace-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "No fue posible el backfill."),
  });

  const list = useMemo(() => {
    const rows = (muebles ?? []) as Mueble[];
    if (filter === "all") return rows;
    return rows.filter((m) => verOf(m) === filter);
  }, [muebles, filter]);

  const cards = [
    { label: "Total", value: stats?.total, tone: "text-slate-900" },
    { label: "Verificados", value: stats?.verificado, tone: "text-emerald-700" },
    { label: "Por verificar", value: stats?.por_verificar, tone: "text-amber-700" },
    { label: "Incompletos", value: stats?.incompleto, tone: "text-slate-500" },
    { label: "Rechazados", value: stats?.rechazado, tone: "text-red-700" },
    { label: "Con fotos reales", value: stats?.conFotosReales, tone: "text-emerald-700" },
    { label: "Sin fotos reales", value: stats?.sinFotosReales, tone: "text-red-700" },
    { label: "Assets pendientes", value: stats?.assetsPendientes, tone: "text-amber-700" },
    { label: "Cambios solicitados", value: stats?.cambiosSolicitados, tone: "text-amber-700" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold text-slate-800 dark:text-white">
            <Layers className="h-5 w-5 text-slate-400" />
            Trazabilidad del catálogo
          </h2>
          <p className="text-sm text-slate-500">
            Estado de verificación y assets de cada producto.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-9 border-slate-200"
          disabled={backfill.isPending}
          onClick={() => {
            if (confirm("Vincular las imágenes existentes (galeria/fotos) como assets rastreados de los productos que aún no tienen assets?"))
              backfill.mutate();
          }}
        >
          {backfill.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCcw className="mr-2 h-4 w-4" />
          )}
          Vincular imágenes existentes
        </Button>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{c.label}</p>
            <p className={cn("mt-1 text-2xl font-serif font-bold", c.tone)}>
              {c.value ?? "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros rápidos */}
      <div className="flex flex-wrap gap-2">
        {(["all", "verificado", "por_verificar", "rechazado", "incompleto"] as VerFilter[]).map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium",
                filter === f
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
              )}
            >
              {f === "all" ? "Todos" : (verBadge[f]?.label ?? f)}
            </button>
          ),
        )}
      </div>

      {/* Lista */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {list.slice(0, 200).map((m) => {
            const badge = verBadge[verOf(m)] ?? verBadge["por_verificar"];
            const img = getDisplayImageUrl(
              (m.galeria?.[0] ?? m.fotos?.[0]) as never,
            );
            return (
              <button
                key={m.id}
                onClick={() => setDetailId(m.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
                  {img ? (
                    <img src={img} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageIcon className="m-2 h-6 w-6 text-slate-300" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {m.nombre}
                  </p>
                  <p className="text-xs text-slate-400">{m.categoria ?? "Sin categoría"}</p>
                </div>
                <Badge variant="outline" className={cn("border", badge!.cls)}>
                  {badge!.label}
                </Badge>
                <span className="hidden w-24 text-right text-sm font-semibold text-slate-600 sm:block">
                  {m.precio ? currency.format(m.precio) : "—"}
                </span>
              </button>
            );
          })}
          {list.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-slate-400">Sin productos.</p>
          ) : null}
        </div>
      </div>

      <MuebleTraceabilityDialog muebleId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

function assetImg(a: MuebleAsset) {
  return getDisplayImageUrl({ id: a.drive_file_id ?? undefined, url: a.url ?? undefined });
}

function MuebleTraceabilityDialog({
  muebleId,
  onClose,
}: {
  muebleId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["mueble-traceability", muebleId],
    queryFn: () => getMuebleTraceability(muebleId as string),
    enabled: Boolean(muebleId),
  });

  const decide = useMutation({
    mutationFn: (input: { id: string; decision: "aprobada" | "rechazada" }) =>
      setAssetReviewDecision({ id: input.id, decision: input.decision, aprobadaPor: "Admin" }),
    onSuccess: async () => {
      toast.success("Asset actualizado.");
      await queryClient.invalidateQueries({ queryKey: ["mueble-traceability", muebleId] });
      await queryClient.invalidateQueries({ queryKey: ["trace-stats"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Error."),
  });

  const m = data?.mueble;
  const woo = m?.detalles?.woocommerce;

  return (
    <Dialog open={Boolean(muebleId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0">
        <ScrollArea className="max-h-[86vh]">
          <div className="p-5 sm:p-6">
            {isLoading || !data ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando trazabilidad…
              </div>
            ) : (
              <>
                <DialogHeader className="text-left">
                  <DialogTitle className="font-serif text-2xl">{m.nombre}</DialogTitle>
                </DialogHeader>

                {/* Datos */}
                <Section icon={BadgeCheck} title="Datos">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <Row k="SKU" v={m.sku ?? "—"} />
                    <Row k="Categoría" v={m.categoria ?? "—"} />
                    <Row k="Marca" v={m.marca ?? "—"} />
                    <Row k="Medidas" v={m.medidas ?? "—"} />
                    <Row k="Materiales" v={m.materiales ?? "—"} />
                    <Row k="Colores" v={m.colores ?? "—"} />
                    <Row k="Precio" v={m.precio ? currency.format(m.precio) : "—"} />
                    <Row k="Verificación" v={m.estado_verificacion ?? "por_verificar"} />
                    <Row k="Verificado por" v={m.verificado_por ?? "—"} />
                    <Row
                      k="Fecha verif."
                      v={m.verificado_at ? new Date(m.verificado_at).toLocaleDateString("es-MX") : "—"}
                    />
                  </dl>
                </Section>

                <AssetSection
                  title="Fotos reales / originales"
                  icon={ShieldCheck}
                  assets={data.assets.filter((a) => ["foto_real", "original"].includes(a.tipo))}
                  onDecide={(id, d) => decide.mutate({ id, decision: d })}
                />
                <AssetSection
                  title="Editadas / IA"
                  icon={ImageIcon}
                  assets={data.assets.filter((a) => ["editada", "ia"].includes(a.tipo))}
                  onDecide={(id, d) => decide.mutate({ id, decision: d })}
                />
                <AssetSection
                  title="Otras"
                  icon={Layers}
                  assets={data.assets.filter(
                    (a) => !["foto_real", "original", "editada", "ia"].includes(a.tipo),
                  )}
                  onDecide={(id, d) => decide.mutate({ id, decision: d })}
                />

                {/* Comentarios */}
                <Section icon={ShieldAlert} title="Comentarios">
                  {data.comments.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin comentarios.</p>
                  ) : (
                    <div className="space-y-2">
                      {data.comments.map((c) => (
                        <div key={c.id} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
                          <p className="text-slate-700">{c.mensaje}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {c.autor || "Eleganzza"} · {c.tipo} ·{" "}
                            {new Date(c.created_at).toLocaleString("es-MX")}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Campañas */}
                <Section icon={Layers} title="Campañas">
                  {data.campanas.length === 0 ? (
                    <p className="text-sm text-slate-400">No está en ninguna campaña.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {data.campanas.map((c) => (
                        <Badge key={c.id} variant="secondary">
                          {c.nombre}
                        </Badge>
                      ))}
                    </div>
                  )}
                </Section>

                {/* Ecommerce */}
                <Section icon={Check} title="Ecommerce (WooCommerce)">
                  {woo?.productId ? (
                    <p className="text-sm text-slate-600">
                      Sincronizado · ID {String(woo.productId)}
                      {woo.lastSyncedAt
                        ? ` · ${new Date(woo.lastSyncedAt).toLocaleDateString("es-MX")}`
                        : ""}
                    </p>
                  ) : (
                    <p className="text-sm text-slate-400">No sincronizado a WooCommerce.</p>
                  )}
                </Section>
              </>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Check;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-6">
      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </h3>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-slate-400">{k}</dt>
      <dd className="text-right font-medium text-slate-700">{v}</dd>
    </>
  );
}

function AssetSection({
  title,
  icon,
  assets,
  onDecide,
}: {
  title: string;
  icon: typeof Check;
  assets: MuebleAsset[];
  onDecide: (id: string, decision: "aprobada" | "rechazada") => void;
}) {
  if (assets.length === 0) return null;
  return (
    <Section icon={icon} title={title}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {assets.map((a) => (
          <div key={a.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <img src={assetImg(a)} alt="" className="aspect-square w-full object-cover" />
            <div className="flex items-center justify-between gap-1 p-1.5">
              <Badge variant="outline" className="text-[9px]">
                {a.estado_revision}
              </Badge>
              <div className="flex gap-1">
                <button
                  className="rounded p-1 text-emerald-600 hover:bg-emerald-50"
                  onClick={() => onDecide(a.id, "aprobada")}
                >
                  <Check className="h-4 w-4" />
                </button>
                <button
                  className="rounded p-1 text-red-600 hover:bg-red-50"
                  onClick={() => onDecide(a.id, "rechazada")}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
