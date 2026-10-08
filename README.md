# ecomaster

Monorepo full-stack con Turborepo. PWA en React + API en Cloudflare
Workers con D1, todo servido desde un solo Worker (mismo origen).

## Estructura

```
apps/
  api/   Hono + Cloudflare Workers (Worker + static assets del web)
  web/   React + Vite (PWA con vite-plugin-pwa)
```

En producción el Worker `tools-api` sirve el frontend (PWA) y la API
(`/api/*`) en el mismo origen: `https://tools-api.devgruposervilong.workers.dev`.

## Comandos

```bash
pnpm install        # dependencias
pnpm dev            # api (:8787) + web (:5173)
pnpm build          # build de ambos (api depende del build de web)
pnpm typecheck      # tsc
pnpm lint           # eslint (web)
```

## API (`apps/api`)

CLI: **`cf`** (Cloudflare CLI, beta). Config tipada en `cloudflare.config.ts`.

- `pnpm --filter @tools/api dev` → `cf dev` en `http://localhost:8787`
- `pnpm --filter @tools/api build` → `cf build` (salida en `.cloudflare/`)
- `pnpm --filter @tools/api deploy` → `cf deploy` (requiere `cf auth login`)
- `pnpm --filter @tools/api db:generate` → `drizzle-kit generate` (migraciones)
- `pnpm --filter @tools/api db:local` / `db:remote` → aplican migraciones con `cf d1 migrations apply`
- `pnpm --filter @tools/api r2:create` → crea el bucket R2 (storage, pendiente)

ORM: **Drizzle** (`drizzle-orm/d1`). Esquema en `src/db/schema.ts`,
migraciones en `migrations/` (con `drizzle-kit`).

El build usa el bundler de Wrangler: `wrangler.config.ts` define
`assetsDirectory: ../web/dist` (build de la PWA) y `cloudflare.config.ts`
enruta `/api/*` al Worker con fallback SPA (`notFoundHandling:
single-page-application`).

Endpoints: `GET /api` y `GET /api/health` (verifica D1).

## Web (`apps/web`)

- `pnpm --filter @tools/api dev` + `pnpm --filter @tools/web dev`
- Vite en `http://localhost:5173` con proxy de `/api` → `http://localhost:8787`
- PWA: manifest "Ecomaster", service worker (Workbox) con precache y caché
  de `/api/*` (NetworkFirst), registrado desde `src/main.tsx`.
- Íconos generados con `@vite-pwa/assets-generator` desde `public/logo-eco-master.png`
  (`pnpm run pwa:icons`): luego `scripts/pwa-icons.mts` aplica fondo negro (para que el
  texto blanco del logo sea visible), alinea `maskable-icon-512x512.png` con `pwa-512x512.png`
  y genera `apple-touch-icon-180x180.png` desde este.

## Nota (Windows)

`workerd.exe` requiere el runtime de Visual C++ 2015-2022. El script
`apps/api/scripts/workerd-runtime.mts` (se ejecuta en `postinstall`) copia las
DLLs necesarias junto al binario; si no las encuentra, instala
<https://aka.ms/vs/17/release/vc_redist.x64.exe>.
