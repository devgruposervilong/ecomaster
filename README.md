# Eco Master Backoffice

Backoffice de aliados comerciales de Eco Master. Monorepo full-stack con
Turborepo, PWA en React y API en Cloudflare Workers con D1, servidos desde un
mismo Worker.

## Estado actual

La primera fase implementa:

- Autenticación con Better Auth y D1.
- Setup inicial protegido por `SETUP_TOKEN`.
- Invitaciones de un solo uso compartibles por WhatsApp.
- Roles `admin`, `partner_admin` y `partner_operator`.
- Aislamiento de datos por aliado.
- Dashboard, usuarios, aliados y ajustes.
- PWA instalable, sin caché de respuestas `/api/*`.

Ventas, catálogo, inventario, finanzas, reportes y tienda online aparecen como
módulos "En construcción" hasta la siguiente fase.

## Estructura

```
apps/
  api/       Hono + Cloudflare Workers (Worker + static assets del web)
  web/       React + Vite (PWA con vite-plugin-pwa)
packages/
  shared/    Contratos Zod y tipos compartidos entre API y web
```

En producción el Worker `tools-api` sirve el frontend (PWA) y la API
(`/api/*`) en el mismo origen.

## Puesta en marcha

Requisitos: Node.js 22+, pnpm 11 y el CLI `cf` para desarrollo local.

```bash
pnpm install

# Crea apps/api/.dev.vars a partir del ejemplo.
cp apps/api/.dev.vars.example apps/api/.dev.vars

# Aplica las migraciones a la D1 local que usa cf dev.
pnpm --filter @tools/api db:local

# En dos terminales:
pnpm --filter @tools/api dev   # http://localhost:8787
pnpm --filter @tools/web dev   # http://localhost:5173
```

Abre <http://localhost:5173/setup> y usa el `SETUP_TOKEN` de `.dev.vars` para
crear el primer administrador. El setup queda deshabilitado en cuanto existe un
administrador.

Para reiniciar la base local (borra usuarios, aliados e invitaciones de prueba):

```powershell
Remove-Item -Recurse -Force apps/api/.wrangler/state
pnpm --filter @tools/api db:local
```

### Variables de entorno

Desarrollo local (`apps/api/.dev.vars`, no se commitea):

- `BETTER_AUTH_SECRET`: secreto largo y aleatorio.
- `SETUP_TOKEN`: token de un solo uso para `/setup`.

La URL pública se configura en `apps/api/cloudflare.config.ts`. Por defecto es
`http://localhost:5173`; en producción exporta `APP_URL` (y opcionalmente
`BETTER_AUTH_URL`) antes de construir/desplegar. En PowerShell:

```powershell
$env:APP_URL = "https://backoffice.ecomaster.com"
pnpm --filter @tools/api deploy
```

En macOS/Linux:

```bash
APP_URL=https://backoffice.ecomaster.com pnpm --filter @tools/api deploy
```

Los secretos de producción deben cargarse con el CLI de Cloudflare (`cf secret
put`) o desde el panel del Worker.

## Comandos

```bash
pnpm dev            # api (:8787) + web (:5173)
pnpm build          # build de ambos (api depende del build de web)
pnpm typecheck      # tsc en todos los paquetes
pnpm lint           # eslint (web)
pnpm format         # Prettier
```

### API (`apps/api`)

CLI: **`cf`** (Cloudflare CLI, beta). Config tipada en `cloudflare.config.ts`.

- `pnpm --filter @tools/api dev` → `cf dev` en `http://localhost:8787`
- `pnpm --filter @tools/api build` → `cf build` (salida en `.cloudflare/`)
- `pnpm --filter @tools/api deploy` → `cf deploy`
- `pnpm --filter @tools/api db:generate` → genera migraciones con Drizzle Kit
- `pnpm --filter @tools/api db:local` → aplica migraciones a D1 local
- `pnpm --filter @tools/api db:remote` → aplica migraciones a D1 remota

ORM: **Drizzle** (`drizzle-orm/d1`). Esquema en `src/db/schema/`, migraciones en
`migrations/`.

`wrangler.config.ts` define `assetsDirectory: ../web/dist` y
`cloudflare.config.ts` enruta `/api` y `/api/*` al Worker con fallback SPA.

Endpoints principales:

- `GET /api/health`
- `GET /api/setup/status`, `POST /api/setup`
- `GET /api/me`
- `GET /api/dashboard/summary`
- `GET|POST /api/invites/:token[/accept]`
- `GET|POST|PATCH /api/admin/partners`, `/api/admin/users`, `/api/admin/invites`

El alta pública de Better Auth (`/api/auth/sign-up/*`) está bloqueada: las
cuentas solo se crean por setup o por invitación.

### Web (`apps/web`)

- Vite en `http://localhost:5173` con proxy de `/api` → `http://localhost:8787`
- PWA con manifest `Eco Master Backoffice`, service worker Workbox y actualización
  automática.
- No se cachean respuestas de `/api/*`: el cache del service worker es compartido
  por el origen y no debe guardar datos autenticados de un aliado.
- Paleta visual: `#FFFFFF`, `#0A0A0A` y `#BCD86C`. Los bordes y separadores usan
  negro con opacidad.

#### Marca y PWA

- `scripts/monochrome-logo.mts` convierte `public/logo-eco-master.png` en
  `public/logo-eco-master-bw.png`.
- `public/logo-eco-master-trimmed.png` y `logo-eco-master-bw-trimmed.png` son las
  versiones recortadas usadas por la interfaz.
- `scripts/pwa-icons.mts` genera los iconos con fondo `#0A0A0A`.
- `scripts/pwa-splash.mts` genera los splash de iOS/iPadOS (18 dispositivos × 2
  orientaciones) con fondo `#0A0A0A` y reescribe los `<link>` de `index.html`.
  Quedan fuera del precache (`globIgnores: ['splash/**']`).
- `pnpm --filter @tools/web pwa:assets` regenera logo B/N, iconos y splash.

Actualizaciones: `registerType: 'autoUpdate'` activa el service worker nuevo al
instante (`skipWaiting` + `clientsClaim`). `src/main.tsx` fuerza
`registration.update()` al arrancar, al volver a la app
(`visibilitychange`/`focus`) y cada 30 minutos. Cloudflare sirve `sw.js` con
`Cache-Control: public, max-age=0, must-revalidate`, así que el navegador
siempre revalida.

## Flujo de invitación

1. Un administrador entra en `/admin/usuarios` o `/admin/aliados`.
2. Genera una invitación para un correo y un aliado.
3. La API devuelve un enlace con un token de un solo uso (se guarda hasheado en
   D1, vence a los 7 días y puede revocarse).
4. El administrador comparte el enlace por WhatsApp.
5. La persona define su nombre y contraseña en `/invitacion/:token`.
6. La cuenta queda asociada al aliado y solo puede ver sus datos.

## Nota (Windows)

`workerd.exe` requiere el runtime de Visual C++ 2015-2022. El script
`apps/api/scripts/workerd-runtime.mts` (se ejecuta en `postinstall`) copia las
DLLs necesarias junto al binario; si no las encuentra, instala
<https://aka.ms/vs/17/release/vc_redist.x64.exe>.
