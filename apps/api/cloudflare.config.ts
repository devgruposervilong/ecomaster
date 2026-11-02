import { bindings, defineConfig, triggers } from 'cf/config'

const envVars = (
  globalThis as {
    process?: { env?: Record<string, string | undefined> }
  }
).process?.env

const appUrl = envVars?.APP_URL ?? 'http://localhost:5173'
const authUrl = envVars?.BETTER_AUTH_URL ?? appUrl
const appEnv = envVars?.APP_ENV ?? 'development'

export default defineConfig({
  worker: {
    name: 'ecomaster-api',
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/index.ts',
    assets: {
      notFoundHandling: 'single-page-application',
      runWorkerFirst: ['/api', '/api/*'],
    },
    observability: {
      enabled: true,
    },
    triggers: [
      // 9:30 pm, 10:00 pm y 11:30 pm en America/Caracas (UTC-4).
      // Cloudflare evalúa los cron en UTC, por eso caen al día siguiente.
      triggers.scheduled({ schedule: '30 1 * * *' }),
      triggers.scheduled({ schedule: '0 2 * * *' }),
      triggers.scheduled({ schedule: '30 3 * * *' }),
    ],
    env: {
      APP_ENV: bindings.text(appEnv),
      APP_URL: bindings.text(appUrl),
      BETTER_AUTH_URL: bindings.text(authUrl),
      BETTER_AUTH_SECRET: bindings.secret(),
      SETUP_TOKEN: bindings.secret(),
      WINK_WEBHOOK_SECRET: bindings.secret(),
      DB: bindings.d1({
        name: 'ecomaster-db',
        id: '0352d618-75f0-4803-9531-e27ce0fb0f59',
      }),
    },
  },
})
