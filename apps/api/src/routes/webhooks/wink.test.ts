import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/sql-js'
import { Hono } from 'hono'
import initSqlJs, { type Database } from 'sql.js'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import * as schema from '../../db/schema'
import { scopeDb } from '../../db/tenancy'
import type { AppEnv } from '../../env'
import { AppError } from '../../lib/errors'
import { errorBody } from '../../lib/http'
import { hmacSha256Hex } from '../../lib/wink/signature'
import { winkWebhookRoutes } from './wink'

const migrationsDir = fileURLToPath(new URL('../../../migrations/', import.meta.url))
const require = createRequire(import.meta.url)
const wasmPath = join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm')

const SECRET = 'wink-route-test-secret'
const WINK_SCOPE = { kind: 'system', reason: 'wink-webhook' } as const

let db: ReturnType<typeof drizzle<typeof schema>>
let app: Hono<AppEnv>

function applyMigrations(database: Database) {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const text = readFileSync(join(migrationsDir, file), 'utf8')

    for (const statement of text.split('--> statement-breakpoint')) {
      const trimmed = statement.trim()
      if (trimmed) database.run(trimmed)
    }
  }

  database.run('PRAGMA foreign_keys = ON')
}

async function send(
  body: string,
  options: { signature?: string; timestamp?: number; secret?: string } = {},
) {
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000)
  const signature =
    options.signature ??
    `sha256=${await hmacSha256Hex(options.secret ?? SECRET, `${timestamp}.${body}`)}`

  return app.request(
    '/api/webhooks/wink',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-wink-timestamp': String(timestamp),
        'x-wink-signature': signature,
      },
      body,
    },
    { WINK_WEBHOOK_SECRET: SECRET } as AppEnv['Bindings'],
  )
}

beforeAll(async () => {
  const wasm = readFileSync(wasmPath)
  const wasmBinary = wasm.buffer.slice(
    wasm.byteOffset,
    wasm.byteOffset + wasm.byteLength,
  ) as ArrayBuffer
  const SQL = await initSqlJs({ wasmBinary })
  const sqlite = new SQL.Database()

  applyMigrations(sqlite)
  db = drizzle(sqlite, { schema })

  app = new Hono<AppEnv>()
  app.onError((error, c) => {
    if (error instanceof AppError) {
      return c.json(errorBody(error.code, error.message, error.details), error.status)
    }

    console.error(error)
    return c.json(errorBody('INTERNAL_ERROR', 'Error inesperado.'), 500)
  })
  app.use('/api/webhooks/*', async (c, next) => {
    c.set('db', scopeDb(db, WINK_SCOPE) as unknown as AppEnv['Variables']['db'])
    c.set('session', null)
    c.set('tenantScope', WINK_SCOPE)
    await next()
  })
  app.route('/api/webhooks', winkWebhookRoutes)
})

beforeEach(() => {
  db.delete(schema.winkWebhookEvents).run()
})

describe('POST /api/webhooks/wink', () => {
  it('guarda el payload crudo y extrae los metadatos', async () => {
    const body = JSON.stringify({
      event: 'new_sale',
      data: { id: 286, updatedAt: '2026-05-04T09:42:00.000Z' },
    })

    const response = await send(body)
    const json = (await response.json()) as {
      ok: boolean
      data: { id: string; event: string; externalSaleId: string; status: string; duplicate: boolean }
    }

    expect(response.status).toBe(200)
    expect(json.data).toMatchObject({
      event: 'new_sale',
      externalSaleId: '286',
      status: 'received',
      duplicate: false,
    })

    const [row] = await db.select().from(schema.winkWebhookEvents)

    expect(row?.payload).toBe(body)
    expect(row?.payloadHash).toHaveLength(64)
    expect(row?.signatureTimestamp).toBeTypeOf('number')
  })

  it('rechaza una firma inválida sin guardar nada', async () => {
    const body = JSON.stringify({ event: 'new_sale', data: { id: 286 } })
    const response = await send(body, { signature: `sha256=${'0'.repeat(64)}` })

    expect(response.status).toBe(401)
    expect(await db.select().from(schema.winkWebhookEvents)).toHaveLength(0)
  })

  it('rechaza un timestamp vencido sin guardar nada', async () => {
    const body = JSON.stringify({ event: 'new_sale', data: { id: 286 } })
    const response = await send(body, {
      timestamp: Math.floor(Date.now() / 1000) - 301,
    })

    expect(response.status).toBe(401)
    expect(await db.select().from(schema.winkWebhookEvents)).toHaveLength(0)
  })

  it('rechaza JSON inválido aunque la firma sea correcta', async () => {
    const response = await send('{esto no es json')

    expect(response.status).toBe(400)
    expect(await db.select().from(schema.winkWebhookEvents)).toHaveLength(0)
  })

  it('guarda como inválido un payload sin data.id', async () => {
    const body = JSON.stringify({ event: 'new_sale', data: {} })
    const response = await send(body)
    const json = (await response.json()) as { data: { status: string } }

    expect(response.status).toBe(200)
    expect(json.data.status).toBe('invalid')

    const [row] = await db.select().from(schema.winkWebhookEvents)

    expect(row?.status).toBe('invalid')
    expect(row?.error).toMatch(/data\.id/)
  })

  it('devuelve el evento existente cuando el payload está duplicado', async () => {
    const body = JSON.stringify({ event: 'new_sale', data: { id: 999 } })

    const first = (await (await send(body)).json()) as { data: { id: string; duplicate: boolean } }
    const second = (await (await send(body)).json()) as { data: { id: string; duplicate: boolean } }

    expect(first.data.duplicate).toBe(false)
    expect(second.data.duplicate).toBe(true)
    expect(second.data.id).toBe(first.data.id)
    expect(await db.select().from(schema.winkWebhookEvents)).toHaveLength(1)
  })

  it('responde 500 si el secreto no está configurado', async () => {
    const response = await app.request(
      '/api/webhooks/wink',
      { method: 'POST', body: '{}' },
      {} as AppEnv['Bindings'],
    )

    expect(response.status).toBe(500)
  })
})
