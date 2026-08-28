import { createFileRoute } from "@tanstack/react-router";

// Página pública que muestra el artefacto "Descubrimiento de Marca Eleganzza"
// (documento HTML autónomo en public/brand-discovery.html) a pantalla completa
// dentro de un iframe, para aislar sus estilos/scripts de la app.
export const Route = createFileRoute("/brand-discovery")({
  head: () => ({
    meta: [
      { title: "Descubrimiento de Marca | Eleganzza" },
      {
        name: "description",
        content: "Descubrimiento de Marca de Eleganzza Muebles.",
      },
    ],
  }),
  component: BrandDiscoveryPage,
});

function BrandDiscoveryPage() {
  return (
    <iframe
      src="/brand-discovery.html"
      title="Descubrimiento de Marca Eleganzza"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        border: "none",
      }}
    />
  );
}
