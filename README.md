# Eleganzza Marketing Hub

Plataforma de Enki Soluciones para el catálogo y el marketing de Eleganzza Muebles.

**La documentación completa está en [Manual-Eleganzza-Marketing-Hub.md](./Manual-Eleganzza-Marketing-Hub.md)**: cómo se usa, cómo está construida, seguridad, operación y trampas conocidas.

- Producción: https://eleganzzamkt.enkidad.com
- Despliegue: automático desde `main` a Vercel

## Desarrollo

```sh
npm install
npm run dev
```

Variables de entorno: ver `.env.example`. Para trabajar en local se traen con `vercel env pull .env.local`.

Antes de subir cambios:

```sh
npx tsc --noEmit
npm run build
```

Cambios de base de datos: migración en `supabase/migrations/` y `supabase db push --linked --yes`.
