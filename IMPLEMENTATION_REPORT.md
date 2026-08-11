# Implementation Report — Trazabilidad de catálogo (Fase 1)

Rama: `feature/trazabilidad` · Fecha: 2026-08-10

Objetivo: convertir la plataforma en la **fuente única de verdad** del catálogo, con
trazabilidad auditable: **producto → fotos → edición/IA → aprobación Eleganzza →
campaña → WooCommerce**. Sin reconstruir la app y sin romper producción.

---

## 1. Qué encontré inicialmente

- **App**: TanStack Start + React 19 + Supabase (anon key + Auth) + Vercel. Server functions en `src/lib/api/*`.
- **`muebles`** (esquema real): `id, nombre, categoria, precio, precio_2, precio_3, fotos(jsonb), galeria(jsonb), descripcion, detalles(jsonb), ultima_modificacion, created_at, updated_at`. Mucho estado vive en `detalles` (p. ej. `detalles.status` = draft/published/discontinued, `detalles.woocommerce`, `detalles.source_catalogo_id`).
- **`campanas`**: sin ninguna relación con muebles/assets. `artes_oficiales(jsonb)` guarda archivos de Drive.
- **`catalogos`**: `id, nombre, pdf_url, drive_folder_id, created_at`. Ligado a muebles solo débilmente vía `muebles.detalles.source_catalogo_id`.
- **Sistema de revisión por token (ya EXISTENTE y bien diseñado)**: `catalog_review_links` (token aleatorio, `is_active`, `expires_at`, `filters`) y `catalog_review_marks`. Ambas con **RLS admin-only**; el acceso público es **solo por RPCs `security definer`** (`get_catalog_review`, `submit_catalog_review_mark`). El rol `anon` no toca tablas. Ruta pública `/catalogo/$token` (mobile-first) con acciones tipo "marca" (delete/change_photo/change_price/note/other).
- **WooCommerce**: sync vía Edge Functions (`woo-sync-product`, etc.) con service role + rol admin. **No había validación previa en el cliente**; la Edge Function solo exige `nombre` no vacío.
- **Imágenes**: se almacenan en **Google Drive** (carpeta por producto); `woo-image-proxy` las sirve. La galería usa `galeria`/`fotos` (arrays jsonb con `{id,url}` o URLs).
- **Seguridad del token**: ya cuenta con token aleatorio, expiración, revocación (`is_active`) y validación server-side. **Gran parte de Fase 12 ya estaba resuelta.**

## 2. Qué reutilicé (no dupliqué)

- El **patrón de RPCs `security definer`** del portal: extendí ese mismo mecanismo en vez de crear otra app o exponer tablas al `anon`.
- **`catalog_review_marks` se mantiene intacto**; la nueva capa `review_comments` convive con él (no lo reemplaza).
- **`muebles.detalles`** sigue guardando datos flexibles (medidas, materiales, colores, disponibilidad, status) — no dupliqué esas columnas.
- **Google Drive** como almacenamiento (se reutilizará para uploads del portal en la siguiente iteración).
- La función `touch_updated_at()` existente para triggers de `updated_at`.
- La lógica de filtros del enlace (`filters` jsonb) se reutiliza en el nuevo helper de scope.

## 3. Qué agregué (migraciones)

Todas **aditivas, idempotentes (`IF NOT EXISTS`) y reversibles**. No borran datos.

| Migración | Contenido |
|---|---|
| `20260810120000_muebles_traceability_fields.sql` | **Fase 1**: columnas `sku, estado_verificacion, verificado_por, verificado_at, observaciones, estado_marketing, estado_ecommerce, foto_principal_asset_id`; check de `estado_verificacion` (incompleto/por_verificar/verificado/rechazado); índices; trigger updated_at. |
| `20260810120100_mueble_assets.sql` | **Fase 2 + 11**: tabla `mueble_assets` (tipo, estado_revision, es_principal, aprobada_por/at, metadata, + `ai_validation_status/score/notes`); FK a `muebles`; FK `foto_principal_asset_id`; índices; RLS admin; trigger. |
| `20260810120200_review_comments.sql` | **Fase 4**: tabla `review_comments` (mueble_id/asset_id/review_link_id, autor, mensaje, tipo, resolved_*); índices; RLS admin. |
| `20260810120300_campana_relations.sql` | **Fase 7**: tablas puente `campana_muebles` y `campana_assets`; índices; RLS admin. |
| `20260810120400_catalog_review_portal_rpcs.sql` | **Fase 3/4/5/12**: RPCs `security definer` para el portal por token: `get_catalog_review_product`, `set_catalog_review_verification`, `set_catalog_asset_decision`, `add_catalog_review_comment`, `register_catalog_review_asset`, + helpers `catalog_review_scope_ok` y `catalog_review_link_by_token`. |

## 4. Qué agregué (código)

- **`src/lib/domain/editorial-rules.ts`** (Fase 6): reglas centralizadas `canUseAssetForMarketing`, `canUseForMarketing`, `canPublishCampaign`, `canSyncToWooCommerce`, `firstError`. Fuente única, sin duplicar en componentes.
- **`src/lib/api/assets.functions.ts`** (Fase 2): capa de datos admin para `mueble_assets` (`getMuebleAssets`, `upsertMuebleAsset`, `setAssetReviewDecision`, `deleteMuebleAsset`), tolerante a que la tabla aún no exista.
- **`src/lib/api/catalog-review.ts`** (Fase 3/4): envolturas de las nuevas RPCs (`getCatalogReviewProduct`, `setCatalogReviewVerification`, `setCatalogAssetDecision`, `addCatalogReviewComment`) + tipos.
- **WooCommerce pre-sync gate (Fase 8)**: `handleSyncWooCommerce` y `handleQueueSelectedWooCommerce` en `SupabaseInventory.tsx` ahora usan `canSyncToWooCommerce`. Bloquea productos sin nombre/precio/imágenes y omite los inelegibles en el envío por lote. La verificación es advertencia (no bloqueante) para no romper el catálogo actual.

## 5. Decisiones técnicas

1. **Extender el patrón de RPCs `security definer`** en lugar de exponer tablas nuevas al `anon`. Motivo: mantiene la superficie pública mínima y la autorización server-side. Alternativa descartada: RLS con políticas para `anon` (más difícil de acotar por token).
2. **Datos flexibles en `detalles`, no columnas nuevas** (medidas/materiales/colores/disponibilidad). Motivo: evitar duplicación; el spec pide no duplicar si ya existe equivalente.
3. **Verificación = bloqueante para marketing/campañas, pero solo advertencia para WooCommerce.** Motivo: el catálogo actual (cientos de productos) aún no tiene el nuevo estado de verificación; bloquear ecommerce de golpe rompería producción. El gate de Woo bloquea lo objetivo (sin nombre/precio/imágenes) y advierte lo demás.
4. **`review_comments` como capa nueva junto a `catalog_review_marks`** (no fusioné ni migré). Motivo: compatibilidad; `marks` es un flujo de "solicitudes" ya usado por el backoffice.
5. **Upload del portal (Fase 5) vía server function + RPC `register_catalog_review_asset`**, no exponiendo credenciales de Drive al browser (pendiente de UI). El archivo se sube server-side y solo se registra el metadato por RPC token-scoped.
6. **Campos IA (Fase 11) creados pero sin lógica de CV** — solo preparan el modelo (`ai_validation_status/score/notes`).

## 6. Riesgos y notas

- **Migraciones NO aplicadas aún** a producción (la acción de escribir en la BD fue bloqueada en esta sesión). El dry-run (`supabase db push --dry-run`) confirmó que aplicarían limpio las 5. Deben aplicarse con `supabase db push` (requiere confirmación del usuario).
- Hasta aplicar migraciones, el gate de Woo funciona con imágenes legado (`galeria`/`fotos`) y no lee `mueble_assets` (tolerado).
- El tipo `Mueble` en `inventory.functions.ts` **aún no incluye** las columnas nuevas; conviene ampliarlo cuando se apliquen migraciones (no bloquea el build).
- RLS de `muebles`: la tabla sigue siendo accesible por `anon` (config pre-existente). Endurecerla es un pendiente de seguridad separado (no se tocó para no romper el flujo actual del inventario que usa anon).

## 7. Pendientes (siguiente iteración — backend listo)

- **Portal (Fase 3/5/10)**: vista de detalle del producto en `/catalogo/$token` con fotos agrupadas por tipo, aprobar/rechazar/solicitar-cambios por imagen, marcar verificado, comentar, subir fotos reales (server function + `register_catalog_review_asset`), y comparación original vs IA (slider before/after).
- **Admin (Fase 9)**: panel de estado del catálogo (verificados, por verificar, con/sin fotos reales, assets pendientes, cambios solicitados) + drawer de trazabilidad por producto (Datos / Fotos reales / IA / Comentarios / Campañas / Ecommerce).
- **Campañas (Fase 7)**: UI para vincular muebles/assets a campañas y bloquear "listo para publicar" con `canPublishCampaign`.
- **Backfill**: migrar `galeria`/`fotos` existentes a `mueble_assets` (tipo `catalogo`, `pendiente`) para poblar la trazabilidad.

## 8. Pruebas realizadas

- `supabase db push --dry-run` → conecta y valida que aplicarían las 5 migraciones nuevas (las 4 previas ya están registradas).
- Build / `tsc --noEmit` / ESLint enfocado sobre los archivos nuevos y modificados (ver commit). La lógica del gate de Woo se ejerció por tipos.
- Pendiente de prueba E2E (requiere migraciones aplicadas + login/token): flujos de portal, aprobación/rechazo, upload y bloqueo.
