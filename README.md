# tools

Monorepo con Turborepo.

## Estructura

```
apps/
  api/   Hono + Cloudflare Workers (D1 + R2)
  web/   React + Vite
```

## Comandos

```bash
pnpm install        # dependencias
pnpm dev            # api (:8787) + web (:5173)
pnpm build          # build de ambos
pnpm typecheck      # tsc
pnpm lint           # eslint (web)
```

## API (`apps/api`)

CLI: **`cf`** (Cloudflare CLI, beta). Config tipada en `cloudflare.config.ts`.

- `pnpm --filter @tools/api dev` → `cf dev` en `http://localhost:8787`
- `pnpm --filter @tools/api build` → `cf build` (salida en `.cloudflare/`)
- `pnpm --filter @tools/api deploy` → `cf deploy` (requiere `cf auth login`)
- `pnpm --filter @tools/api db:local` → `cf d1 migrations apply --local`
- `pnpm --filter @tools/api db:remote` → `cf d1 migrations apply`
- `pnpm --filter @tools/api db:create` / `r2:create` → crea los recursos

Bindings en `cloudflare.config.ts`: `DB` (D1), `STORAGE` (R2), `APP_ENV`.

Endpoints: `GET /` y `GET /health` (verifica D1 y R2).

Antes de desplegar hay que crear los recursos y reemplazar
`REPLACE_WITH_D1_DATABASE_ID`:

```bash
pnpm --filter @tools/api db:create    # cf d1 create tools-db
pnpm --filter @tools/api r2:create    # cf r2 buckets create-by-name tools-storage
cf auth login
```

## Web (`apps/web`)

- `pnpm --filter @tools/api dev` + `pnpm --filter @tools/web dev`
- Vite en `http://localhost:5173` con proxy de `/api` → `http://localhost:8787`

## Nota (Windows)

`workerd.exe` requiere el runtime de Visual C++ 2015-2022. El script
`apps/api/scripts/workerd-runtime.mjs` (se ejecuta en `postinstall`) copia las
DLLs necesarias junto al binario; si no las encuentra, instala
<https://aka.ms/vs/17/release/vc_redist.x64.exe>.
