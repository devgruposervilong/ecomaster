import { Hono } from 'hono'
import type { AppEnv } from './env'

export const app = new Hono<AppEnv>()

app.get('/', (c) => c.json({ name: 'tools-api', status: 'ok' }))

app.get('/health', async (c) => {
  const dbOk = await c.env.DB.prepare('SELECT 1 AS ok')
    .first<{ ok: number }>()
    .then(() => true)
    .catch(() => false)

  return c.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk })
})
