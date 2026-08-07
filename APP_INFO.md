# Eleganzza MKT - Informacion de la aplicacion

Ultima actualizacion: 2026-08-07  
Aplicacion: Eleganzza Marketing / Inventario  
URL principal: https://eleganzzamkt.enkidad.com  
URL Vercel: https://eleganzzamkt.vercel.app  
Estado de produccion verificado: Ready en Vercel

## Desarrollo

Esta aplicacion fue adecuada y desplegada con apoyo de Codex, trabajando en el repositorio local y en servicios conectados como Vercel, Supabase, GoDaddy DNS, Google Drive, WooCommerce y OpenAI.

- Desarrollada/adecuada por: Codex
- Tarea/conversacion Codex: `019fcfbf-9e14-79c1-80d5-246dd0be148f`
- Enlace de conversacion: no disponible como URL publica desde este entorno; abrir desde la app de Codex con el id anterior.

## GitHub

- Repositorio: https://github.com/cruiz-enki/eleganzzamkt.git
- Rama de trabajo actual: `feature/woocommerce-connection`
- Primer commit local observado: `4681b32` - 2026-08-01 - `template: tanstack_start_ts_current-ef9d4b21c54a`
- Ultimo commit documentado: `311768a` - 2026-08-07 - `chore: configure custom app domain`

## Stack tecnico

- Framework: TanStack Start
- Frontend: React 19, Vite
- Backend server functions: TanStack Start `createServerFn`
- Base de datos/Auth: Supabase
- Hosting: Vercel
- DNS: GoDaddy / domaincontrol.com
- Integraciones: OpenAI, Google Drive, WooCommerce, Airtable legacy

Dependencias clave:

- `@tanstack/react-start`: `^1.168.32`
- `@supabase/supabase-js`: `^2.111.0`
- `react`: `^19.2.0`
- `vite`: `^8.1.5`
- `typescript`: `^5.8.3`
- `zod`: `^3.24.2`

Scripts principales:

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

## Vercel

- Proyecto: `eleganzzamkt`
- Project ID: `prj_XLTdU7HL8nCfEEzVPC39Be6sh2LJ`
- Team/Org ID: `team_Fop7HkRjGVcXnbsTtwX4l9rv`
- Owner: `cruiz-7616's projects`
- Fecha de creacion del proyecto Vercel: 2026-08-04 22:43:42
- Root directory: `.`
- Node.js runtime: 24.x
- Framework preset: TanStack Start
- Build command: `npm run build` o `vite build`

Ultimo deployment verificado:

- Deployment ID: `dpl_B58QdqBCM5wdYzpTjTaahRxkUWpf`
- Deployment URL: `https://eleganzzamkt-3cr1svccg-cruiz-7616s-projects.vercel.app`
- Target: production
- Estado: Ready
- Fecha: 2026-08-07 10:33:00 America/Mexico_City

Aliases activos:

- https://eleganzzamkt.enkidad.com
- https://eleganzzamkt.vercel.app
- https://eleganzzamkt-cruiz-7616s-projects.vercel.app
- https://eleganzzamkt-cruiz-7616-cruiz-7616s-projects.vercel.app

## DNS

Dominio configurado:

- `eleganzzamkt.enkidad.com`

Proveedor DNS:

- GoDaddy
- Nameservers:
  - `ns61.domaincontrol.com`
  - `ns62.domaincontrol.com`

Registro configurado:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| CNAME | `eleganzzamkt` | `1b3243d6aa956e2e.vercel-dns-017.com.` |

Vercel reporto el dominio como configurado correctamente mediante CNAME.

## Supabase

- Project ref: `eqshiiiekxbpsdilckuv`
- Nombre local enlazado: `eleganzza@enkisoluciones.mx's Project`
- Organization ID local: `jykirfqinlqrottsodgi`
- Supabase URL: `https://eqshiiiekxbpsdilckuv.supabase.co`
- Postgres version observada: `17.6.1.155`
- REST version observada: `v14.15`
- GoTrue/Auth version observada: `v2.195.0`

Cliente frontend:

- Archivo: `src/lib/supabase-client.ts`
- Variable URL: `VITE_SUPABASE_URL`
- Variable anon key: `VITE_SUPABASE_ANON_KEY`
- Anon key publica registrada localmente: `eyJhbGciOiJI...DXGSS9OQ` (enmascarada)

Nota de seguridad: la anon key de Supabase es una llave publica pensada para el cliente. No se documenta completa aqui para evitar copiar credenciales en archivos versionados; el valor completo vive en Vercel y Supabase.

Tablas usadas por la aplicacion:

- `muebles`
- `campanas`
- `catalogos`
- `catalog_review_links`
- `catalog_review_marks`

Migraciones en el repo:

- `supabase/migrations/20260806015651_catalog_review_links.sql`

La migracion crea:

- `catalog_review_links`
- `catalog_review_marks`
- Funcion `touch_updated_at`
- RPC publica controlada por token `get_catalog_review`
- RPC publica controlada por token `submit_catalog_review_mark`
- Politicas RLS para administracion autenticada por `cruiz@enkisoluciones.mx`

## Auth

Proteccion de app:

- Componente: `src/components/auth/AuthGate.tsx`
- Usuario permitido: `cruiz@enkisoluciones.mx`
- Login: email/password mediante Supabase Auth
- Recovery: Supabase password recovery
- Dominio de fallback de la app: `https://eleganzzamkt.enkidad.com`

Pendiente observado:

- `supabase/config.toml` aun contiene `site_url = "https://eleganzzamkt.vercel.app"` y redirects de `vercel.app`.
- Conviene actualizar la configuracion real de Supabase Auth para incluir:
  - `https://eleganzzamkt.enkidad.com`
  - `https://eleganzzamkt.enkidad.com?auth_action=recovery`
  - `https://eleganzzamkt.enkidad.com/**`

## Edge Functions de Supabase

Funciones en `supabase/functions`:

| Funcion | JWT | Proposito |
| --- | --- | --- |
| `woo-test-connection` | Si | Prueba segura de conexion WooCommerce REST API v3 |
| `woo-sync-product` | Si | Sincroniza un producto de Supabase hacia WooCommerce |
| `woo-image-proxy` | No | Proxy publico de imagenes de Google Drive para WooCommerce |

Arquitectura WooCommerce:

```text
Frontend -> Supabase Edge Function -> WooCommerce REST API v3
```

No se conectan credenciales de WooCommerce directamente desde el navegador.

## Integraciones y secretos

Variables de entorno documentadas por nombre. No guardar valores secretos reales en el repositorio.

Variables publicas:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_PUBLIC_APP_URL`

Variables privadas en Vercel:

- `OPENAI_API_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_DRIVE_ROOT_FOLDER_ID`

Variables privadas en Supabase Edge Functions:

- `WOOCOMMERCE_URL`
- `WOOCOMMERCE_CONSUMER_KEY`
- `WOOCOMMERCE_CONSUMER_SECRET`

OpenAI:

- Archivo: `src/lib/api/openai.ts`
- Endpoint: `https://api.openai.com/v1/responses`
- Modelo por defecto en codigo: `gpt-5.6-luna`
- Variable: `OPENAI_API_KEY`

Google Drive:

- Archivo: `src/lib/api/google-drive.ts`
- Uso: crear carpetas, subir imagenes, listar imagenes por carpeta, hacer archivos publicos.
- Variable raiz: `GOOGLE_DRIVE_ROOT_FOLDER_ID`

WooCommerce:

- Cliente frontend: `src/lib/api/woocommerce.ts`
- Hook de conexion: `src/hooks/use-woocommerce-connection.ts`
- Hook de sync producto: `src/hooks/use-woocommerce-product-sync.ts`
- Edge functions:
  - `woo-test-connection`
  - `woo-sync-product`
  - `woo-image-proxy`

## Rutas principales

- `/` - dashboard protegido por Supabase Auth
- `/catalogo/$token` - catalogo publico de revision para clientes

La ruta publica de catalogo permite que clientes marquen:

- eliminar producto
- cambiar foto
- cambiar precio
- nota
- otro

## Modulos principales

- `src/components/dashboard/SupabaseInventory.tsx` - gestion de productos
- `src/components/dashboard/CatalogosManager.tsx` - gestion de catalogos
- `src/components/dashboard/CatalogReviewLinksManager.tsx` - enlaces publicos de revision
- `src/components/auth/AuthGate.tsx` - proteccion de acceso
- `src/lib/api/inventory.functions.ts` - operaciones server-side de inventario
- `src/lib/api/catalog-review.ts` - API de revision publica de catalogo
- `src/lib/api/openai.ts` - cliente OpenAI
- `src/lib/api/google-drive.ts` - cliente Google Drive
- `src/lib/api/woocommerce.ts` - cliente de Edge Functions WooCommerce

## Comandos utiles

Desarrollo local:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Lint:

```bash
npm run lint
```

Deploy production:

```bash
npx vercel --prod --yes
```

Verificar dominio:

```bash
npx vercel domains verify eleganzzamkt.enkidad.com
```

Listar variables Vercel:

```bash
npx vercel env ls
```

Desplegar funciones Supabase:

```bash
supabase functions deploy woo-test-connection --project-ref eqshiiiekxbpsdilckuv
supabase functions deploy woo-sync-product --project-ref eqshiiiekxbpsdilckuv
supabase functions deploy woo-image-proxy --project-ref eqshiiiekxbpsdilckuv --no-verify-jwt
```

## Notas de seguridad

- No guardar `OPENAI_API_KEY` en archivos versionados.
- No guardar `GOOGLE_CLIENT_SECRET` ni `GOOGLE_REFRESH_TOKEN` en archivos versionados.
- No guardar `WOOCOMMERCE_CONSUMER_KEY` ni `WOOCOMMERCE_CONSUMER_SECRET` en tablas ni frontend.
- La anon key de Supabase puede estar en frontend, pero RLS debe proteger los datos.
- `woo-image-proxy` es publica por diseno para que WooCommerce pueda descargar imagenes; no recibe credenciales.

