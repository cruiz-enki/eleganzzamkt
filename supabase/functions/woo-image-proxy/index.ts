const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function response(body: BodyInit | null, status: number, headers: HeadersInit = {}) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Cache-Control": status === 200 ? "public, max-age=86400" : "no-store",
      ...headers,
    },
  });
}

function getDriveId(req: Request) {
  const url = new URL(req.url);
  const fileName = url.pathname.split("/").pop() ?? "";
  const driveId = fileName.replace(/\.(jpg|jpeg|png|webp)$/i, "");

  return /^[A-Za-z0-9_-]{10,}$/.test(driveId) ? driveId : null;
}

async function fetchDriveImage(driveId: string) {
  const urls = [
    `https://lh3.googleusercontent.com/d/${driveId}=w1600`,
    `https://drive.google.com/thumbnail?id=${driveId}&sz=w1600`,
  ];

  for (const url of urls) {
    const result = await fetch(url, {
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "User-Agent": "Eleganzza-Woo-Image-Proxy/1.0",
      },
    }).catch(() => null);

    const contentType = result?.headers.get("content-type") ?? "";
    if (result?.ok && contentType.toLowerCase().startsWith("image/")) return result;
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response("ok", 200);
  if (req.method !== "GET") return response("Método no permitido", 405);

  const driveId = getDriveId(req);
  if (!driveId) return response("Imagen no válida", 400);

  const image = await fetchDriveImage(driveId);
  if (!image) return response("No se pudo obtener la imagen", 404);

  const contentType = image.headers.get("content-type") ?? "image/jpeg";
  return response(image.body, 200, {
    "Content-Type": contentType,
  });
});
