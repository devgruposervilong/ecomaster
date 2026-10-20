import { bindings, defineConfig } from 'cf/config'

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
    name: 'tools-api',
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
    env: {
      APP_ENV: bindings.text(appEnv),
      APP_URL: bindings.text(appUrl),
      BETTER_AUTH_URL: bindings.text(authUrl),
      BETTER_AUTH_SECRET: bindings.secret(),
      SETUP_TOKEN: bindings.secret(),
      DB: bindings.d1({
        name: 'tools-db',
        id: '584af39d-eb80-486e-8b85-abe9e46b530d',
      }),
    },
  },
})
