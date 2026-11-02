# Eco Master Backoffice

Backoffice de aliados comerciales de Eco Master. Monorepo full-stack con
Turborepo, PWA en React y API en Cloudflare Workers con D1, servidos desde un
mismo Worker.

## Estado actual

La primera fase implementa:

- Autenticación con Better Auth y D1.
- Setup inicial protegido por `SETUP_TOKEN`.
- Invitaciones de un solo uso compartibles por WhatsApp.
- Roles `admin`, `partner_admin`, `collaborator` y `partner_collaborator`.
- Aislamiento de datos por aliado.
- Dashboard, usuarios, aliados y ajustes.
- Catálogo por aliado con productos, precios, categorías, códigos Profit e
  historial de cambios de precio.
- Permisos por módulo para los roles colaboradores, configurables por usuario
  desde Usuarios.
- IDs CUID2 (`@paralleldrive/cuid2`) para los registros nuevos.
- PWA instalable, sin caché de respuestas `/api/*`.

Ventas, inventario, finanzas, reportes y tienda online aparecen como módulos
"En construcción" hasta la siguiente fase. El catálogo lo administra el rol
global `admin`; los demás roles tienen acceso de solo lectura al catálogo que
les corresponde. `admin` y `partner_admin` tienen acceso total a los módulos;
los colaboradores solo a los módulos habilitados por el administrador.

### Roles y módulos

| Rol                   | Alcance              | Acceso                                                       |
| --------------------- | -------------------- | ------------------------------------------------------------ |
| `admin`               | Global               | Todos los módulos; gestiona aliados, usuarios e invitaciones |
| `partner_admin`       | Su aliado            | Todos los módulos de su aliado                               |
| `collaborator`        | Global               | Solo los módulos asignados a su usuario                      |
| `partner_collaborator` | Su aliado            | Solo los módulos asignados a su usuario                      |

Los módulos configurables son `dashboard`, `sales`, `catalog`, `inventory`,
`finance`, `reports` y `store`. `Ajustes` está disponible para cualquier usuario
autenticado y los módulos de administración no se pueden asignar a un
colaborador. La asignación se guarda por usuario (y por invitación mientras está
pendiente), no por rol.

## Estructura

```
apps/
  api/       Hono + Cloudflare Workers (Worker + static assets del web)
  web/       React + Vite (PWA con vite-plugin-pwa)
packages/
  shared/    Contratos Zod y tipos compartidos entre API y web
```

En producción el Worker `ecomaster-api` sirve el frontend (PWA) y la API
(`/api/*`) en el mismo origen.

## Puesta en marcha

Requisitos: Node.js 22+, pnpm 11 y el CLI `cf` para desarrollo local.

```bash
pnpm install

# Crea apps/api/.dev.vars a partir del ejemplo.
cp apps/api/.dev.vars.example apps/api/.dev.vars

# Aplica las migraciones a la D1 local que usa cf dev.
pnpm --filter @ecomaster/api db:local

# En dos terminales:
pnpm --filter @ecomaster/api dev   # http://localhost:8787
pnpm --filter @ecomaster/web dev   # http://localhost:5173
```

Abre <http://localhost:5173/setup> y usa el `SETUP_TOKEN` de `.dev.vars` para
crear el primer administrador. El setup queda deshabilitado en cuanto existe un
administrador.

Para reiniciar la base local (borra usuarios, aliados e invitaciones de prueba):

```powershell
Remove-Item -Recurse -Force apps/api/.wrangler/state
pnpm --filter @ecomaster/api db:local
```

### Variables de entorno

Desarrollo local (`apps/api/.dev.vars`, no se commitea):

- `BETTER_AUTH_SECRET`: secreto largo y aleatorio.
- `SETUP_TOKEN`: token de un solo uso para `/setup`.
- `WINK_WEBHOOK_SECRET`: secreto HMAC compartido con Wink.

`cloudflare.config.ts` usa `http://localhost:5173` para `APP_URL` y
`BETTER_AUTH_URL` en desarrollo, de modo que Vite sirve el frontend y hace proxy
de `/api` al Worker local.

Para producción, `pnpm --filter @ecomaster/api run deploy` ejecuta
`apps/api/scripts/deploy.mts`. Ese script publica el Worker en el subdominio
gratuito de Cloudflare y configura automáticamente la URL pública:

```text
https://ecomaster-api.devgruposervilong.workers.dev
```

El primer acceso a producción se hace en `/setup` usando el `SETUP_TOKEN` del
Worker. Cuando ya existe un administrador, `/setup` queda deshabilitado.

Cuando exista un dominio propio, exporta `APP_URL` (y opcionalmente
`BETTER_AUTH_URL`) antes de desplegar. En PowerShell:

```powershell
$env:APP_URL = "https://backoffice.ecomaster.com"
pnpm --filter @ecomaster/api run deploy
```

En macOS/Linux:

```bash
APP_URL=https://backoffice.ecomaster.com pnpm --filter @ecomaster/api run deploy
```

Los secretos de producción deben cargarse desde el panel del Worker
(**Settings → Variables and Secrets**) o con `cf workers secrets update`.

### Webhook de Wink

La tienda online `https://ecomaster.winktienda.com/` envía sus ventas a:

```text
POST https://ecomaster-api.devgruposervilong.workers.dev/api/webhooks/wink
```

Autenticación HMAC-SHA256:

- `X-Wink-Timestamp`: segundos Unix.
- `X-Wink-Signature`: `sha256=<hex(HMAC_SHA256(WINK_WEBHOOK_SECRET, "<timestamp>.<body-crudo>"))>`.
- Tolerancia de tiempo: 300 segundos.

Configura en el Backoffice de Wink (**API & Webhooks**) la URL, selecciona
autenticación HMAC con el mismo valor de `WINK_WEBHOOK_SECRET` y activa el
endpoint.

Desarrollo local (`apps/api/.dev.vars`):

```text
WINK_WEBHOOK_SECRET=el-mismo-secreto-configurado-en-wink
```

Puesta en marcha en producción:

1. Genera un secreto distinto al de desarrollo:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. Aplica la migración:

   ```powershell
   pnpm --filter @ecomaster/api db:remote
   ```

3. Carga el secreto en el panel de Cloudflare (**Workers & Pages →
   ecomaster-api → Settings → Variables and Secrets → Add secret**) con el
   nombre `WINK_WEBHOOK_SECRET`. Como alternativa, desde el CLI:

   ```powershell
   pnpm --filter @ecomaster/api exec cf workers secrets update WINK_WEBHOOK_SECRET `
     --worker ecomaster-api --type secret_text --text "el-secreto"
   ```

   El valor pasado con `--text` queda en el historial del shell; el panel es la
   opción recomendada.

4. Despliega el Worker:

   ```powershell
   pnpm --filter @ecomaster/api run deploy
   ```

5. Configura el endpoint en Wink (ver arriba).

La Fase 1 solo guarda el payload crudo en `wink_webhook_events`. No crea ventas,
no asigna aliado y no interpreta SKU, importes ni pagos. La tabla es interna:
solo el scope `system` escribe y el `admin` puede leerla; ningún aliado tiene
acceso.

Probar el endpoint con un payload firmado:

```powershell
$env:WINK_WEBHOOK_SECRET = "el-secreto"
$env:WINK_WEBHOOK_URL = "http://127.0.0.1:8787/api/webhooks/wink"
node apps/api/scripts/wink-webhook-send.mts
```

Para producción cambia `WINK_WEBHOOK_URL` por la URL pública. Consulta los
eventos recibidos:

```sql
SELECT id, external_sale_id, event, status, received_at
FROM wink_webhook_events
ORDER BY received_at DESC
LIMIT 20;
```

Los duplicados se detectan por `payload_hash` y devuelven el evento existente.
Un payload firmado pero sin `event` o `data.id` se guarda con `status =
'invalid'`; un JSON inválido se rechaza con `400` y una firma inválida o vencida
con `401`.

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

- `pnpm --filter @ecomaster/api dev` → `cf dev` en `http://localhost:8787`
- `pnpm --filter @ecomaster/api build` → `cf build` (salida en `.cloudflare/`)
- `pnpm --filter @ecomaster/api run deploy` → `scripts/deploy.mts` → `cf deploy`
- `pnpm --filter @ecomaster/api db:generate` → genera migraciones con Drizzle Kit
- `pnpm --filter @ecomaster/api db:local` → aplica migraciones a D1 local
- `pnpm --filter @ecomaster/api db:remote` → aplica migraciones a D1 remota

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
- `POST /api/webhooks/wink` (webhook HMAC de Wink)
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
- `pnpm --filter @ecomaster/web pwa:assets` regenera logo B/N, iconos y splash.

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
