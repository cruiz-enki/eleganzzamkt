import { createFileRoute } from "@tanstack/react-router";

// Página pública que muestra el artefacto "Descubrimiento de Marca Eleganzza"
// (public/brand-discovery.html) a pantalla completa en un iframe.
// Le pasamos la config de Supabase (URL + anon key públicas) por el hash, para
// que el botón "Enviar a Eleganzza" del formulario envíe las respuestas al
// panel sin dejar la llave escrita en el archivo estático.

const SUPABASE_URL =
  (import.meta.env["VITE_SUPABASE_URL"] as string) || "https://eqshiiiekxbpsdilckuv.supabase.co";
const SUPABASE_ANON = (import.meta.env["VITE_SUPABASE_ANON_KEY"] as string) || "";

function buildSrc() {
  const cfg = btoa(JSON.stringify({ u: SUPABASE_URL, k: SUPABASE_ANON }));
  return `/brand-discovery.html#cfg=${encodeURIComponent(cfg)}`;
}

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
      src={buildSrc()}
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
