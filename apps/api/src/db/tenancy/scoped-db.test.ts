import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { and, count, eq, is, sql, Table } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { drizzle } from 'drizzle-orm/sql-js'
import initSqlJs, { type Database } from 'sql.js'
import { beforeAll, describe, expect, it } from 'vitest'
import * as schema from '../schema'
import {
  buildTenantPredicate,
  resolveTablePolicy,
  scopeDb,
  TenancyError,
  type TenantScope,
} from './index'

const partnerA: TenantScope = { kind: 'partner', partnerId: 'pa' }
const partnerB: TenantScope = { kind: 'partner', partnerId: 'pb' }
const admin: TenantScope = { kind: 'admin' }
const deny: TenantScope = { kind: 'deny' }
const winkSystem: TenantScope = { kind: 'system', reason: 'wink-webhook' }

const migrationsDir = fileURLToPath(new URL('../../../migrations/', import.meta.url))
const require = createRequire(import.meta.url)
const wasmPath = join(dirname(require.resolve('sql.js')), 'sql-wasm.wasm')

let db: ReturnType<typeof drizzle<typeof schema>>

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

  db.insert(schema.priceLists)
    .values([
      {
        id: 'pl-a',
        name: 'Lista Aliado A',
        currency: 'USD',
        status: 'active',
      },
      {
        id: 'pl-b',
        name: 'Lista Aliado B',
        currency: 'EUR',
        status: 'active',
      },
    ])
    .run()

  db.insert(schema.partners)
    .values([
      {
        id: 'pa',
        name: 'Aliado A',
        slug: 'aliado-a',
        type: 'permanente',
        currency: 'USD',
        priceListId: 'pl-a',
      },
      {
        id: 'pb',
        name: 'Aliado B',
        slug: 'aliado-b',
        type: 'bazar',
        currency: 'EUR',
        priceListId: 'pl-b',
      },
    ])
    .run()

  db.insert(schema.user)
    .values([
      {
        id: 'ua',
        name: 'Usuario A',
        email: 'a@example.com',
        emailVerified: true,
        role: 'partner_admin',
        partnerId: 'pa',
      },
      {
        id: 'ub',
        name: 'Usuario B',
        email: 'b@example.com',
        emailVerified: true,
        role: 'partner_admin',
        partnerId: 'pb',
      },
      {
        id: 'uadmin',
        name: 'Admin',
        email: 'admin@example.com',
        emailVerified: true,
        role: 'admin',
        partnerId: null,
      },
    ])
    .run()

  db.insert(schema.invites)
    .values([
      {
        id: 'inv-a',
        tokenHash: 'hash-a',
        email: 'invite-a@example.com',
        partnerId: 'pa',
        role: 'partner_collaborator',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      {
        id: 'inv-b',
        tokenHash: 'hash-b',
        email: 'invite-b@example.com',
        partnerId: 'pb',
        role: 'partner_collaborator',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    ])
    .run()

  db.insert(schema.auditLogs)
    .values([
      {
        id: 'audit-a',
        partnerId: 'pa',
        action: 'test.a',
        entityType: 'test',
        entityId: 'pa',
        description: 'Actividad de A',
      },
      {
        id: 'audit-b',
        partnerId: 'pb',
        action: 'test.b',
        entityType: 'test',
        entityId: 'pb',
        description: 'Actividad de B',
      },
      {
        id: 'audit-b-leak',
        partnerId: 'pb',
        action: 'test.leak',
        entityType: 'test',
        entityId: 'pa',
        description: 'Intento de fuga con entityId de A',
      },
    ])
    .run()

  db.insert(schema.products)
    .values([
      {
        id: 'prod-a',
        sku: 'A-001',
        name: 'Producto A',
        type: 'article',
        status: 'active',
      },
      {
        id: 'prod-b',
        sku: 'B-001',
        name: 'Producto B',
        type: 'article',
        status: 'active',
      },
    ])
    .run()

  db.insert(schema.priceListItems)
    .values([
      {
        id: 'pli-a',
        priceListId: 'pl-a',
        productId: 'prod-a',
        price: 12,
      },
      {
        id: 'pli-b',
        priceListId: 'pl-b',
        productId: 'prod-b',
        price: 25,
      },
    ])
    .run()

  db.insert(schema.priceHistory)
    .values([
      {
        id: 'hist-a',
        priceListId: 'pl-a',
        productId: 'prod-a',
        oldPrice: null,
        newPrice: 12,
        currency: 'USD',
        changedBy: 'ua',
        changedByName: 'Usuario A',
      },
      {
        id: 'hist-b',
        priceListId: 'pl-b',
        productId: 'prod-b',
        oldPrice: null,
        newPrice: 25,
        currency: 'EUR',
        changedBy: 'ub',
        changedByName: 'Usuario B',
      },
    ])
    .run()

  db.insert(schema.sales)
    .values([
      {
        id: 'sale-a',
        partnerId: 'pa',
        partnerName: 'Aliado A',
        partnerRif: null,
        priceListId: 'pl-a',
        priceListName: 'Lista Aliado A',
        currency: 'USD',
        usdRate: 36.5,
        eurRate: 42,
        rateDate: '2026-10-29',
        subtotalUsd: 0,
        discountUsd: 0,
        ivaUsd: 0,
        totalUsd: 0,
        subtotalEur: 0,
        discountEur: 0,
        ivaEur: 0,
        totalEur: 0,
        subtotalVes: 0,
        discountVes: 0,
        ivaVes: 0,
        totalVes: 0,
        discountType: 'none',
        discountValue: 0,
        soldAt: new Date(),
        status: 'confirmed',
        paymentStatus: 'unpaid',
        createdByName: 'Usuario A',
      },
      {
        id: 'sale-b',
        partnerId: 'pb',
        partnerName: 'Aliado B',
        partnerRif: null,
        priceListId: 'pl-b',
        priceListName: 'Lista Aliado B',
        currency: 'EUR',
        usdRate: 36.5,
        eurRate: 42,
        rateDate: '2026-10-29',
        subtotalUsd: 0,
        discountUsd: 0,
        ivaUsd: 0,
        totalUsd: 0,
        subtotalEur: 0,
        discountEur: 0,
        ivaEur: 0,
        totalEur: 0,
        subtotalVes: 0,
        discountVes: 0,
        ivaVes: 0,
        totalVes: 0,
        discountType: 'none',
        discountValue: 0,
        soldAt: new Date(),
        status: 'confirmed',
        paymentStatus: 'unpaid',
        createdByName: 'Usuario B',
      },
    ])
    .run()
})

describe('scopeDb', () => {
  it('filtra las filas de un aliado sin where explícito', async () => {
    const tdb = scopeDb(db, partnerA)

    const rows = await tdb.select().from(schema.partners)

    expect(rows.map((row) => row.id)).toEqual(['pa'])
  })

  it('mantiene el filtro aunque el where apunte a otro aliado', async () => {
    const tdb = scopeDb(db, partnerA)

    const rows = await tdb.select().from(schema.partners).where(eq(schema.partners.id, 'pb'))

    expect(rows).toHaveLength(0)
  })

  it('filtra la actividad propia y no la de otro aliado', async () => {
    const tdb = scopeDb(db, partnerA)

    const rows = await tdb.select().from(schema.auditLogs)

    expect(rows.map((row) => row.id)).toContain('audit-a')
    expect(rows.map((row) => row.id)).not.toContain('audit-b')
    expect(rows.every((row) => row.partnerId === 'pa')).toBe(true)
  })

  it('no permite que un aliado consulte usuarios ni invitaciones', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() => tdb.select().from(schema.user)).toThrow(TenancyError)
    expect(() => tdb.select().from(schema.invites)).toThrow(TenancyError)
  })

  it('no permite que un aliado consulte ni escriba los webhooks de Wink', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() => tdb.select().from(schema.winkWebhookEvents)).toThrow(TenancyError)
    expect(() =>
      tdb.insert(schema.winkWebhookEvents).values({
        payloadHash: 'hash-aliado',
        payload: '{}',
      }),
    ).toThrow(TenancyError)
  })

  it('el scope system registra webhooks de Wink y el admin solo los lee', async () => {
    const sdb = scopeDb(db, winkSystem)

    await sdb.insert(schema.winkWebhookEvents).values({
      id: 'wink-1',
      externalSaleId: '286',
      event: 'new_sale',
      payloadHash: 'hash-1',
      payload: '{"event":"new_sale","data":{"id":286}}',
      status: 'received',
      signatureTimestamp: 1_800_000_000,
    })

    await sdb
      .update(schema.winkWebhookEvents)
      .set({ status: 'processed', processedAt: new Date() })
      .where(eq(schema.winkWebhookEvents.id, 'wink-1'))

    const rows = await sdb
      .select({ id: schema.winkWebhookEvents.id, status: schema.winkWebhookEvents.status })
      .from(schema.winkWebhookEvents)

    expect(rows).toEqual([{ id: 'wink-1', status: 'processed' }])

    const adb = scopeDb(db, admin)
    const adminRows = await adb
      .select({ id: schema.winkWebhookEvents.id })
      .from(schema.winkWebhookEvents)

    expect(adminRows).toEqual([{ id: 'wink-1' }])
    expect(() =>
      adb.insert(schema.winkWebhookEvents).values({
        payloadHash: 'hash-admin',
        payload: '{}',
      }),
    ).toThrow(TenancyError)
  })

  it('no permite que un aliado cree aliados', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() =>
      tdb.insert(schema.partners).values({
        id: 'pc',
        name: 'Aliado C',
        slug: 'aliado-c',
        type: 'permanente',
        currency: 'USD',
        priceListId: 'pl-a',
      }),
    ).toThrow(TenancyError)
  })

  it('inyecta el partnerId en inserts propios', async () => {
    const tdb = scopeDb(db, partnerA)

    await tdb.insert(schema.auditLogs).values({
      action: 'test.insert',
      entityType: 'test',
      description: 'Insert propio',
    })

    const [row] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.action, 'test.insert'))

    expect(row?.partnerId).toBe('pa')
  })

  it('rechaza inserts con el partnerId de otro aliado', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() =>
      tdb.insert(schema.auditLogs).values({
        action: 'test.cross',
        entityType: 'test',
        description: 'Intento cross-tenant',
        partnerId: 'pb',
      }),
    ).toThrow(/otro aliado/i)
  })

  it('bloquea onConflictDoUpdate en scope partner', () => {
    const tdb = scopeDb(db, partnerA)
    const insert = tdb.insert(schema.auditLogs).values({
      action: 'test.upsert',
      entityType: 'test',
      description: 'Intento de upsert',
    }) as unknown as {
      onConflictDoUpdate: (config: unknown) => unknown
    }

    expect(() =>
      insert.onConflictDoUpdate({
        target: schema.auditLogs.id,
        set: { description: 'cambiado' },
      }),
    ).toThrow(TenancyError)
  })

  it('el predicado de escritura no cruza aliados', async () => {
    const { policy } = resolveTablePolicy(schema.auditLogs)
    const predicate = buildTenantPredicate(schema.auditLogs, policy, partnerA)

    expect(predicate).toBeDefined()

    await db
      .update(schema.auditLogs)
      .set({ description: 'cross update' })
      .where(and(eq(schema.auditLogs.id, 'audit-b'), predicate))

    const [afterUpdate] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, 'audit-b'))

    expect(afterUpdate?.description).toBe('Actividad de B')

    await db.delete(schema.auditLogs).where(and(eq(schema.auditLogs.id, 'audit-b'), predicate))

    const [afterDelete] = await db
      .select()
      .from(schema.auditLogs)
      .where(eq(schema.auditLogs.id, 'audit-b'))

    expect(afterDelete).toBeDefined()
  })

  it('no permite updates ni deletes sin where', () => {
    const adb = scopeDb(db, admin)

    expect(() => adb.update(schema.auditLogs).set({ description: 'sin where' }).run()).toThrow(
      TenancyError,
    )

    expect(() => adb.delete(schema.auditLogs).run()).toThrow(TenancyError)
  })

  it('no deja que un join con una clave débil filtre filas de otro aliado', async () => {
    const tdb = scopeDb(db, partnerA)

    const rows = await tdb
      .select()
      .from(schema.partners)
      .innerJoin(schema.auditLogs, eq(schema.auditLogs.entityId, schema.partners.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.audit_logs.id).toBe('audit-a')
  })

  it('aplica el filtro también a tablas con alias', async () => {
    const tdb = scopeDb(db, partnerA)
    const other = alias(schema.auditLogs, 'other')

    const rows = await tdb
      .select({ logId: other.id })
      .from(schema.partners)
      .innerJoin(other, eq(other.entityId, schema.partners.id))

    expect(rows).toEqual([{ logId: 'audit-a' }])
  })

  it('el admin ve todos los aliados', async () => {
    const adb = scopeDb(db, admin)

    const partners = await adb.select().from(schema.partners)
    const invites = await adb.select().from(schema.invites)

    expect(partners.map((row) => row.id).sort()).toEqual(['pa', 'pb'])
    expect(invites.map((row) => row.id).sort()).toEqual(['inv-a', 'inv-b'])
  })

  it('falla cerrado con scope deny', () => {
    const ddb = scopeDb(db, deny)

    expect(() => ddb.select().from(schema.partners)).toThrow(TenancyError)
  })

  it('bloquea set operators, subqueries y prepared queries en scope partner', () => {
    const tdb = scopeDb(db, partnerA)
    const base = tdb.select().from(schema.auditLogs) as unknown as {
      union: (other: unknown) => unknown
      as: (alias: string) => unknown
      prepare: () => unknown
    }

    expect(() => base.union(base)).toThrow(TenancyError)
    expect(() => base.as('sub')).toThrow(TenancyError)
    expect(() => base.prepare()).toThrow(TenancyError)
  })

  it('bloquea SQL crudo', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() => (tdb as unknown as { run: (query: unknown) => void }).run(sql`select 1`)).toThrow(
      TenancyError,
    )
    expect(() => (tdb as unknown as { session: unknown }).session).toThrow(TenancyError)
    expect(() => (tdb as unknown as { $primary: unknown }).$primary).toThrow(TenancyError)

    const selectBase = tdb.select().from(schema.auditLogs) as unknown as {
      session: unknown
      config: unknown
    }
    expect(() => selectBase.session).toThrow(TenancyError)
    expect(() => selectBase.config).toThrow(TenancyError)

    const insertBase = tdb.insert(schema.auditLogs).values({
      action: 'test.internal',
      entityType: 'test',
      description: 'Intento de acceso interno',
    }) as unknown as { session: unknown }
    expect(() => insertBase.session).toThrow(TenancyError)
  })

  it('rechaza batch con queries sin scope', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() =>
      (tdb as unknown as { batch: (queries: unknown[]) => unknown }).batch([
        db.select().from(schema.partners),
      ]),
    ).toThrow(TenancyError)
  })

  it('los productos, listas y precios son globales de solo lectura para el aliado', async () => {
    const tdb = scopeDb(db, partnerA)

    const productRows = await tdb.select({ id: schema.products.id }).from(schema.products)
    const listRows = await tdb.select({ id: schema.priceLists.id }).from(schema.priceLists)
    const itemRows = await tdb.select({ id: schema.priceListItems.id }).from(schema.priceListItems)
    const historyRows = await tdb.select({ id: schema.priceHistory.id }).from(schema.priceHistory)

    expect(productRows.map((row) => row.id).sort()).toEqual(['prod-a', 'prod-b'])
    expect(listRows.map((row) => row.id).sort()).toEqual(['pl-a', 'pl-b'])
    expect(itemRows.map((row) => row.id).sort()).toEqual(['pli-a', 'pli-b'])
    expect(historyRows.map((row) => row.id).sort()).toEqual(['hist-a', 'hist-b'])
  })

  it('no permite que un aliado escriba el catalogo global', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() =>
      tdb.insert(schema.products).values({ sku: 'X-1', name: 'Producto X' }),
    ).toThrow(TenancyError)
    expect(() =>
      tdb.insert(schema.priceLists).values({ name: 'Lista X', currency: 'USD' }),
    ).toThrow(TenancyError)
    expect(() =>
      tdb.update(schema.products).set({ name: 'Cambio' }).where(eq(schema.products.id, 'prod-a')),
    ).toThrow(TenancyError)
    expect(() => tdb.delete(schema.products).where(eq(schema.products.id, 'prod-a'))).toThrow(
      TenancyError,
    )
  })

  it('el admin puede crear productos globales sin partnerId', async () => {
    const adb = scopeDb(db, admin)

    await adb
      .insert(schema.products)
      .values({ id: 'prod-admin', sku: 'ADMIN-1', name: 'Producto admin' })

    const [row] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, 'prod-admin'))

    expect(row?.sku).toBe('ADMIN-1')
  })

  it('aisla ventas y pagos por aliado', async () => {
    const tdb = scopeDb(db, partnerA)

    const saleRows = await tdb.select({ id: schema.sales.id }).from(schema.sales)
    expect(saleRows.map((row) => row.id)).toEqual(['sale-a'])

    await tdb.insert(schema.salePayments).values({
      id: 'pay-a',
      partnerId: 'pa',
      saleId: 'sale-a',
      currency: 'USD',
      amount: 1,
      amountVes: 36.5,
      usdRate: 36.5,
      eurRate: 42,
      rateDate: '2026-10-29',
      method: 'cash',
      paidAt: new Date(),
      createdByName: 'Usuario A',
    })

    const [payment] = await db
      .select()
      .from(schema.salePayments)
      .where(eq(schema.salePayments.id, 'pay-a'))

    expect(payment?.partnerId).toBe('pa')
  })

  it('rechaza un pago sobre la venta de otro aliado', () => {
    const tdb = scopeDb(db, partnerA)

    expect(() =>
      tdb.insert(schema.salePayments).values({
        id: 'pay-cross',
        partnerId: 'pb',
        saleId: 'sale-b',
        currency: 'EUR',
        amount: 1,
        amountVes: 42,
        usdRate: 36.5,
        eurRate: 42,
        rateDate: '2026-10-29',
        method: 'cash',
        paidAt: new Date(),
        createdByName: 'Usuario A',
      }),
    ).toThrow(/otro aliado/i)
  })

  it('la FK compuesta impide mezclar la moneda del aliado y de su lista', () => {
    expect(() =>
      db
        .insert(schema.partners)
        .values({
          id: 'pc',
          name: 'Aliado C',
          slug: 'aliado-c',
          type: 'permanente',
          currency: 'USD',
          priceListId: 'pl-b',
        })
        .run(),
    ).toThrow(/foreign key/i)
  })
})
describe('DB guards', () => {
  it('impide dejar a un usuario no-admin sin aliado', () => {
    db.insert(schema.user)
      .values({
        id: 'uguard',
        name: 'Usuario guard',
        email: 'guard@example.com',
        emailVerified: true,
        role: 'partner_collaborator',
        partnerId: 'pa',
      })
      .run()

    expect(() =>
      db.update(schema.user).set({ partnerId: null }).where(eq(schema.user.id, 'uguard')).run(),
    ).toThrow(/invalid partner assignment for role/i)
  })

  it('permite que un colaborador global quede sin aliado', () => {
    db.insert(schema.user)
      .values({
        id: 'ucoord',
        name: 'Colaborador global',
        email: 'coord@example.com',
        emailVerified: true,
        role: 'partner_collaborator',
        partnerId: 'pa',
      })
      .run()

    expect(() =>
      db
        .update(schema.user)
        .set({ role: 'collaborator', partnerId: null })
        .where(eq(schema.user.id, 'ucoord'))
        .run(),
    ).not.toThrow()
  })

  it('permite que un admin quede sin aliado', () => {
    db.insert(schema.user)
      .values({
        id: 'uadmin2',
        name: 'Admin 2',
        email: 'admin2@example.com',
        emailVerified: true,
        role: 'partner_collaborator',
        partnerId: 'pa',
      })
      .run()

    expect(() =>
      db
        .update(schema.user)
        .set({ role: 'admin', partnerId: null })
        .where(eq(schema.user.id, 'uadmin2'))
        .run(),
    ).not.toThrow()
  })
})

describe('registry', () => {
  it('clasifica todas las tablas del schema', () => {
    const tables = Object.values(schema).filter((value) => is(value, Table))

    expect(tables.length).toBeGreaterThan(0)

    for (const table of tables) {
      expect(() => resolveTablePolicy(table)).not.toThrow()
    }
  })

  it('el partner B también queda aislado', async () => {
    const tdb = scopeDb(db, partnerB)

    const partners = await tdb.select().from(schema.partners)
    const activity = await tdb.select().from(schema.auditLogs)

    expect(partners.map((row) => row.id)).toEqual(['pb'])
    expect(activity.map((row) => row.id).sort()).toEqual(['audit-b', 'audit-b-leak'])
  })
})
