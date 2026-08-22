# Eleganzza Marketing Hub

Plataforma de **Enki Soluciones** para administrar el catálogo y el marketing de **Eleganzza Muebles**.

| | |
|---|---|
| **Dirección** | https://eleganzzamkt.enkidad.com |
| **Repositorio** | github.com/cruiz-enki/eleganzzamkt |
| **Última actualización de este manual** | 22 de agosto de 2026 |

---

# Parte 1 — Para quien la usa

## Entrar

Se entra con correo y contraseña en https://eleganzzamkt.enkidad.com. La sesión queda guardada en el navegador.

Tener cuenta de acceso **no basta**: además hace falta un perfil activo dentro de la plataforma. Si alguien entra con una cuenta sin perfil, ve un mensaje explicándolo y nada más. Los perfiles los crea un administrador desde la sección **Usuarios**.

### Los tres roles

| Rol | Puede |
|---|---|
| **Administrador** | Todo: administrar usuarios, configuración y **borrar** |
| **Editor** | Ver y editar productos, publicaciones y campañas. **No borra** |
| **Lector** | Solo ver |

Estos permisos no son solo cosmética del menú: están escritos en la base de datos. Un lector que intente escribir recibe un rechazo de la base, aunque encontrara la forma de saltarse la interfaz.

### Dar de alta a alguien

**Usuarios → Nuevo usuario.** Se captura correo, nombre y rol. La plataforma genera una **contraseña temporal que se muestra una sola vez** — hay que copiarla y compartirla en ese momento. Si se pierde, se genera otra con el botón *Contraseña*; no hay forma de consultar la anterior.

Tres candados de seguridad: nadie puede cambiar su propio rol, desactivarse ni borrarse. Así la plataforma nunca se queda sin administrador.

---

## Las secciones

### Dashboard
Resumen: inventario por categoría, campaña vigente y catálogos cargados.

### Productos
El corazón de la plataforma. Lista completa del catálogo con búsqueda, filtros por categoría, estado y galería, vista de tabla o de mosaico, y columnas configurables.

Al abrir un producto se despliega su ficha en tres pestañas:

- **Ficha** — categoría, SKU, marca, medidas, materiales, colores, descripción, estado de verificación y número de fotos. Los campos vacíos se muestran como *"Sin dato"* en vez de esconderse, para que se vea de un vistazo qué le falta al mueble.
- **Publicaciones** — las publicaciones de redes ligadas a ese mueble, con su estado y quién las autorizó.
- **Integraciones** — carpeta de Google Drive, estado en WooCommerce e historial de sincronización.

#### Herramientas (menú dentro de Productos)

| Herramienta | Qué hace |
|---|---|
| **Importar de Airtable** | Trae productos nuevos desde la base de Airtable. Descarga **todas** las imágenes de cada mueble (Foto Editada e Imagen Original) y las guarda en Google Drive |
| **Recuperar fotos faltantes** | Pestaña dentro del importador. Busca muebles que quedaron sin ninguna foto y las rescata desde Airtable |
| **Importar CSV** | Carga masiva desde archivo |
| **Completar fichas con IA** | Lee la descripción de cada producto y extrae marca, medidas, materiales y colores. **Nada se guarda hasta que lo revisas** |
| **Cargar lista de precios** | Se sube el PDF del proveedor, se leen los renglones, se cruzan contra los muebles sin precio y se aprueba uno por uno |
| **Exportar** | CSV y Excel |

**Sobre la extracción con IA:** solo extrae lo que el texto ya dice; si no lo dice, deja el campo vacío. Prefiere un campo en blanco a un dato inventado. Los productos ya procesados no se vuelven a mandar (se gasta dinero para obtener el mismo resultado), pero hay un interruptor para forzarlos si se corrigió la descripción.

**Sobre las listas de precios:** el cruce no se conforma con que coincida el nombre del modelo — valida el **tipo** contra la categoría. Si un mueble está capturado como *CAMAS* y en la lista aparece un *SILLÓN Montreal*, esa opción se descarta sola. Los casos con varias opciones se marcan en ámbar para que una persona decida. De cada precio aplicado queda registrado de qué archivo y de qué renglón salió.

### Trazabilidad
Tablero del estado del catálogo: verificados, por verificar, con o sin fotos reales, fotos pendientes de aprobación y cambios solicitados. Incluye un cajón por producto con su historial completo.

### Campañas
Campañas con fechas, descripción, enlace de Canva y artes oficiales subidos a Drive.

### Publicaciones
Flujo completo de aprobación de contenido de redes:

1. **Nueva publicación** — se sube la imagen o el video, se escribe el copy, se elige la red social y la fecha propuesta. Opcionalmente se liga a un mueble del catálogo.
2. **A revisión** — la publicación queda visible para el cliente.
3. **Eleganzza decide** desde su enlace: *Autorizar*, *Cambios* o *Rechazar*.
4. **Ya publicada** — se marca a mano cuando salió en la red. *La plataforma no publica sola en Instagram ni Facebook.*

Filtros por estado y, al abrir cada publicación, el historial de decisiones del cliente.

Si la publicación se liga a un mueble, los archivos se guardan en la carpeta de Drive **de ese mueble**, dentro de una subcarpeta `Publicaciones`, y aparecen en la ficha del producto.

### Catálogos
Catálogos digitales en PDF y extracción de productos desde ellos.

### Marca
El design system de Eleganzza: identidad, paleta completa (clic en un color para copiar su código), tipografías con muestras reales, reglas de voz y fundamentos de diseño. Es la referencia para cualquier arte que se haga para el cliente.

### IA Generator
Generación de copys de marketing con la voz de la marca.

### Configuración
Enlaces de revisión del catálogo, integración con WooCommerce y estado del sistema.

### Usuarios
Solo para administradores. Descrita arriba.

---

## Los portales del cliente

Eleganzza no tiene cuenta en la plataforma. Entra por **enlaces con token**: una liga larga y aleatoria que se puede revocar y que puede tener fecha de caducidad. Sin contraseñas que administrar.

| Portal | Dirección | Para qué |
|---|---|---|
| **Catálogo** | `/catalogo/{token}` | Revisar productos y pedir cambios de foto, de precio, eliminación o dejar notas |
| **Publicaciones** | `/publicaciones/{token}` | Autorizar, pedir cambios o rechazar publicaciones |

Los enlaces son de un solo tipo cada uno: un enlace de publicaciones **no** abre el catálogo, ni al revés.

Ambos portales están hechos para el celular. Quien revisa escribe su nombre y queda registrado en cada decisión.

**Pedir cambios exige escribir qué cambiar.** No es un capricho de la interfaz: la base rechaza la operación sin comentario. Un "cambios solicitados" sin explicación no le sirve a nadie.

---

## Notificaciones

La campana del encabezado avisa de cuatro cosas:

| Tipo | Cuándo |
|---|---|
| **Decisiones del cliente** | Eleganzza autoriza, pide cambios o rechaza una publicación |
| **Marcas en el catálogo** | El cliente marca un producto pidiendo un cambio |
| **Fallas técnicas** | Falla la sincronización con WooCommerce o productos que se importan sin imágenes |
| **Procesos terminados** | Acaba una importación, una carga de precios o el completado de fichas |

Cada persona del equipo recibe su propia copia y marca las suyas como leídas. Al hacer clic, la notificación lleva a la sección correspondiente. Se revisan cada minuto.

---

## Estado del catálogo

Al 22 de agosto de 2026:

| | |
|---|---|
| Muebles | **623** |
| Con foto | **606** |
| Con descripción | 512 |
| Con ficha completada por IA | 416 |
| **Con precio** | **221** |
| Catálogos · Campañas · Publicaciones | 1 · 1 · 1 |
| Enlaces de revisión activos | 4 |

**El hueco más grande son los precios:** 402 muebles no tienen. No es un problema de la plataforma — esa información no existe en Airtable ni en las listas de proveedor cargadas. De los faltantes, 128 son candiles y 26 cuadros, categorías de las que no hay lista de precios.

---

# Parte 2 — Para quien la mantiene

## Cómo está construida

| Pieza | Tecnología |
|---|---|
| Aplicación | TanStack Start (React 19) + Vite + Tailwind + shadcn/ui |
| Base de datos y acceso | Supabase (PostgreSQL + Auth) |
| Hospedaje | Vercel, despliegue automático desde `main` |
| Imágenes | Google Drive (unidad compartida) |
| Catálogo origen | Airtable, base "Eleganzza Catálogo", tabla `Total` |
| IA | OpenAI (texto, lectura de PDF y visión) |
| Tienda en línea | WooCommerce, vía Edge Functions de Supabase |

### Dónde corre cada cosa

Esta distinción es la que más fácil se rompe:

| Tipo de archivo | Dónde corre | Con qué permisos |
|---|---|---|
| `*.functions.ts` y `system-health.ts` | Servidor | Llave de servicio (`supabase-admin`) |
| `traceability.ts`, `catalog-review.ts`, `publicaciones.ts`, `usuarios.ts`, `notificaciones.ts`, `woocommerce*.ts`, componentes | Navegador | Llave pública + la sesión de quien usa la app |

**Regla:** si necesita credenciales de Google, OpenAI o Airtable, va en el servidor. Si necesita saber quién es el usuario para que apliquen los permisos, va en el navegador.

---

## Seguridad

Hay tres capas, y las tres importan:

**1. Quién entra.** Supabase Auth valida correo y contraseña. Después, la plataforma exige un perfil activo en la tabla `perfiles`. Sin perfil no se pasa.

**2. Qué puede hacer (base de datos).** Todas las tablas tienen Row Level Security con políticas por operación: *ver* = cualquier rol, *crear y editar* = admin o editor, *borrar* = solo admin. Los helpers en SQL son `es_admin()`, `puede_editar()` y `puede_ver()`.

**3. Las funciones del servidor.** Una server function es un endpoint público y corre con la llave de servicio, que **se salta** las reglas de la base. Por eso llevan candado propio: `src/lib/api/auth-middleware.ts` verifica el token de sesión y exige el rol mínimo. Tres niveles: `requiereSesion`, `requiereEditor`, `requiereAdmin`.

**Excepción deliberada:** `catalog-review.functions.ts` no lleva candado porque sirve al portal público, donde no hay sesión. Ahí la autorización la hace el token del enlace dentro de funciones `security definer`.

### Las llaves y dónde viven

| Llave | Dónde | Nota |
|---|---|---|
| `VITE_SUPABASE_ANON_KEY` | Navegador (pública) | Sin poder propio: todo lo filtra RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor | **Nunca** lleva prefijo `VITE_`, o Vite la metería en el navegador |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Solo servidor | Cuenta de servicio, no caduca |
| `OPENAI_API_KEY`, `AIRTABLE_API_KEY` | Solo servidor | |

Todas viven en Vercel (Production, Preview y Development) y en `.env.local` para trabajar en local. `.env.local` está en `.gitignore`.

**Verificación obligatoria tras tocar esto:** que la llave de servicio no aparezca en el bundle del navegador.

```bash
npm run build
grep -rl "SUPABASE_SERVICE_ROLE_KEY" .vercel/output/static | wc -l   # debe ser 0
```

---

## Modelo de datos

| Tabla | Para qué |
|---|---|
| `muebles` | El catálogo. Columnas fijas + `detalles` (jsonb) para lo flexible |
| `mueble_assets` | Fotos con su estado de revisión y quién las aprobó |
| `catalogos` | Catálogos PDF |
| `campanas`, `campana_muebles`, `campana_assets` | Campañas y sus relaciones |
| `publicaciones`, `publicacion_comentarios` | Publicaciones de redes y su historial de decisiones |
| `catalog_review_links` | Enlaces por token. La columna `tipo` distingue catálogo de publicaciones |
| `catalog_review_marks`, `review_comments` | Lo que el cliente pide |
| `perfiles` | Quién entra y con qué rol |
| `notificaciones` | Una fila por persona |
| `woocommerce_sync_jobs`, `woocommerce_sync_history` | Cola e historial de sincronización |

Dentro de `muebles.detalles` conviven varias marcas útiles: `google_drive_folder_id`, `source`, `airtable_id`, `specs_extracted_at`, `precio_origen`, `woocommerce`.

---

## Operación

### Desplegar
Se hace solo: cada push a `main` dispara un despliegue en Vercel. No hay paso manual.

### Cambios en la base de datos
Van siempre como migración en `supabase/migrations/` (19 a la fecha) y se aplican con:

```bash
supabase db push --linked --yes
```

**Al crear una tabla nueva, incluir siempre `grant ... to service_role`.** Las migraciones anteriores lo olvidaron y dejaron al servidor sin permisos en 12 de 15 tablas; el error tardó semanas en salir a la luz.

### Antes de subir cambios

```bash
npx tsc --noEmit    # tipos
npm run build       # compilación
```

`npm run lint` completo falla por errores heredados ajenos; conviene correrlo enfocado en los archivos tocados.

**Advertencia honesta:** no hay pruebas automatizadas ni integración continua. Ni el compilador ni el build detectan errores de comportamiento — en una sola sesión se escaparon cuatro: un portal que pedía contraseña, un `order by` mal formado, fotos duplicadas y una ficha que mostraba datos viejos. Los cuatro compilaban sin quejarse. **Probar en el navegador no es opcional.**

---

## Trampas conocidas

Cosas que ya costaron caro y conviene no redescubrir:

**El permiso de Google Drive caducaba.** Se usaba OAuth con un refresh token que expiraba, y cuando moría, la creación de carpetas fallaba **en silencio**: 309 productos se importaron sin una sola foto. Hoy se usa una cuenta de servicio, que no caduca. Prueba rápida de la conexión:

```bash
node scripts/verificar-drive.mjs
```

**Las artes de redes van en subcarpeta.** Los archivos de una publicación se guardan en `{Mueble}/Publicaciones`, no sueltos en la carpeta del producto. Si se dejan sueltos, el botón "sincronizar con Drive" los mete a la galería de fotos del mueble y de ahí se van a WooCommerce.

**`fotos` y `galeria` guardan lo mismo.** `fotos` es la portada, o sea una copia de `galeria[0]`. Al mostrarlas juntas hay que deduplicar con `uniqueImages()`, o cada producto aparece con su primera foto repetida.

**Las URLs de Airtable caducan en dos horas.** En una importación larga, las últimas ya están muertas. Por eso cada producto relee su ficha en Airtable justo antes de descargar.

**Las rutas públicas van exceptuadas del guardia de sesión.** En `src/routes/__root.tsx`. Si se agrega un portal nuevo y se olvida, el cliente ve la pantalla de login de Enki.

**La tabla `muebles` estuvo abierta a internet.** Con la llave pública se podía leer, editar y **borrar** todo el catálogo. Corregido, pero vale saber de dónde venimos.

---

## Pendientes

**Los precios.** 402 muebles sin precio, y sin ellos no se puede vender ni sincronizar a WooCommerce — el candado editorial exige precio. Faltan las listas de candiles y cuadros, que son 154 productos.

**Nadie usa el flujo de verificación del catálogo.** Las tablas, el panel y el portal existen, pero hay cero decisiones registradas. En cambio el de publicaciones se estrenó el mismo día. Vale la pena averiguar por qué antes de construirle más encima.

**WooCommerce está casi sin usar:** 8 productos de 623.

**Pruebas automatizadas e integración continua.** Hoy cada cambio llega a producción con la sola revisión de quien lo hizo.

**`SupabaseInventory.tsx` tiene más de 2,200 líneas.** Es el archivo donde nacen casi todos los errores. No es coincidencia.

**Sin respaldo del catálogo.** Las fotos viven en un Drive y los datos en Supabase, sin exportación periódica.

**Limpieza de imágenes con IA** (en backlog, se hará a mano). Las fotos no son fotos de producto con marca de agua: son páginas de catálogo y diapositivas, a veces con dos muebles y con marcas de agua encima de la pieza. Recortar resuelve muchos casos sin IA; generar la imagen con IA **redibuja el mueble** y no sirve para vender.

---

*Documento mantenido por Enki Soluciones. Si algo aquí ya no coincide con la plataforma, gana la plataforma — y hay que actualizar el documento.*
