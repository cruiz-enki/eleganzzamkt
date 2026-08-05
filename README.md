# Eleganzza MKT

.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://eleganzzamkt.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8ddcb816-e674-4695-b60a-0c200f9ac7f0).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Vercel

This app uses TanStack Start through Lovable's Vite config. Nitro is pinned to
the Vercel preset in `vite.config.ts`, so the default build command works:

```sh
npm run build
```

Configure these environment variables in Vercel before production deploys:

```sh
LOVABLE_API_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=
AIRTABLE_API_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

## WooCommerce

La primera etapa de integración solo prueba la conexión. El navegador invoca la
Edge Function `woo-test-connection`; la función lee los secretos en Supabase y
hace `GET /wp-json/wc/v3/system_status` con Basic Auth. No se publican ni se
modifican productos.

Configura los secretos en Supabase CLI:

```sh
supabase secrets set WOOCOMMERCE_URL=https://tu-tienda.com
supabase secrets set WOOCOMMERCE_CONSUMER_KEY=ck_xxx
supabase secrets set WOOCOMMERCE_CONSUMER_SECRET=cs_xxx
```

La función requiere JWT válido y un usuario con rol administrativo en
`app_metadata.role = "admin"` o dentro de `app_metadata.roles`. Despliega la
función con:

```sh
supabase functions deploy woo-test-connection
```
