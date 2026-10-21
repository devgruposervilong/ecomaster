import { spawn } from 'node:child_process'

/**
 * Mientras no exista un dominio propio, el backoffice se publica en el
 * subdominio workers.dev de la cuenta de Cloudflare.
 *
 * `cf deploy` construye y despliega el Worker. Le pasamos la URL pública para
 * que `cloudflare.config.ts` la use como APP_URL/BETTER_AUTH_URL.
 */
const CLOUDFLARE_URL = 'https://tools-api.devgruposervilong.workers.dev'

const appUrl = process.env.APP_URL ?? CLOUDFLARE_URL
const env = {
  ...process.env,
  APP_ENV: process.env.APP_ENV ?? 'production',
  APP_URL: appUrl,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? appUrl,
}

const child = spawn('cf', ['deploy', ...process.argv.slice(2)], {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
})

child.on('error', (error) => {
  console.error(error)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
