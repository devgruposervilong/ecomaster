import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import type { AppEnv } from './env'
import { createDb } from './db'

export const app = new Hono<AppEnv>()

app.get('/api', (c) => c.json({ name: 'tools-api', status: 'ok' }))

app.get('/api/health', async (c) => {
  const db = createDb(c.env.DB)
  const dbOk = await db
    .run(sql`SELECT 1`)
    .then(() => true)
    .catch(() => false)

  return c.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk })
})
