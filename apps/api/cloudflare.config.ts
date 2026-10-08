import { bindings, defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'tools-api',
    compatibilityDate: '2026-09-01',
    compatibilityFlags: ['nodejs_compat'],
    entrypoint: 'src/index.ts',
    observability: {
      enabled: true,
    },
    env: {
      APP_ENV: bindings.text('development'),
      DB: bindings.d1({
        name: 'tools-db',
        id: '584af39d-eb80-486e-8b85-abe9e46b530d',
      }),
    },
  },
})
