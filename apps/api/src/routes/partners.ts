import { and, count, desc, eq, inArray, like, or, sql } from 'drizzle-orm'
import { getTableColumns } from 'drizzle-orm'
import { Hono } from 'hono'
import {
  createPartnerSchema,
  listPartnersQuerySchema,
  updatePartnerSchema,
  type Partner,
} from '@tools/shared'
import { partners, session as sessionTable, user } from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { notFound } from '../lib/errors'
import { newId, slugify } from '../lib/ids'
import { jsonBody, queryParams } from '../lib/validation'

export const partnerRoutes = new Hono<AppEnv>()

const PARTNER_INACTIVE_REASON = 'Acceso suspendido porque el aliado está inactivo.'

function nullable(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function serializePartner(row: typeof partners.$inferSelect & { userCount: number }): Partner {
  return {
    ...row,
    userCount: Number(row.userCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function findPartner(db: AppEnv['Variables']['db'], id: string) {
  const [row] = await db
    .select({
      ...getTableColumns(partners),
      userCount: sql<number>`count(${user.id})`,
    })
    .from(partners)
    .leftJoin(user, eq(user.partnerId, partners.id))
    .where(eq(partners.id, id))
    .groupBy(partners.id)
    .limit(1)

  return row ? serializePartner(row) : null
}

async function uniqueSlug(db: AppEnv['Variables']['db'], name: string) {
  const base = slugify(name) || 'aliado'
  let candidate = base
  let suffix = 2

  while (suffix < 100) {
    const [existing] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.slug, candidate))
      .limit(1)

    if (!existing) return candidate

    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return `${base}-${Date.now()}`
}

partnerRoutes.get('/', queryParams(listPartnersQuerySchema), async (c) => {
  const { search, status, type, page, pageSize } = c.req.valid('query')
  const db = c.get('db')

  const conditions = []
  if (search) {
    conditions.push(
      or(
        like(partners.name, `%${search}%`),
        like(partners.slug, `%${search}%`),
        like(partners.contactEmail, `%${search}%`),
      ),
    )
  }
  if (status) conditions.push(eq(partners.status, status))
  if (type) conditions.push(eq(partners.type, type))

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [totalRow] = await db.select({ total: count() }).from(partners).where(where)

  const rows = await db
    .select({
      ...getTableColumns(partners),
      userCount: sql<number>`count(${user.id})`,
    })
    .from(partners)
    .leftJoin(user, eq(user.partnerId, partners.id))
    .where(where)
    .groupBy(partners.id)
    .orderBy(desc(partners.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const total = Number(totalRow?.total ?? 0)

  return c.json({
    data: rows.map(serializePartner),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

partnerRoutes.get('/options', async (c) => {
  const rows = await c
    .get('db')
    .select({
      id: partners.id,
      name: partners.name,
      type: partners.type,
      currency: partners.currency,
      contactPhone: partners.contactPhone,
    })
    .from(partners)
    .where(eq(partners.status, 'active'))
    .orderBy(partners.name)

  return c.json({ data: rows })
})

partnerRoutes.post('/', jsonBody(createPartnerSchema), async (c) => {
  const body = c.req.valid('json')
  const db = c.get('db')
  const id = newId()
  const slug = await uniqueSlug(db, body.name)

  await db.insert(partners).values({
    id,
    name: body.name,
    slug,
    type: body.type,
    currency: body.currency,
    status: 'active',
    profitWarehouseCode: nullable(body.profitWarehouseCode),
    contactName: nullable(body.contactName),
    contactPhone: nullable(body.contactPhone),
    contactEmail: nullable(body.contactEmail),
    notes: nullable(body.notes),
  })

  const created = await findPartner(db, id)

  await writeAudit(c, {
    action: 'partners.create',
    entityType: 'partner',
    entityId: id,
    partnerId: id,
    description: `Creó el aliado ${body.name}.`,
    metadata: { type: body.type, currency: body.currency },
  })

  return c.json({ data: created }, 201)
})

partnerRoutes.patch('/:id', jsonBody(updatePartnerSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')
  const [existing] = await db
    .select({ id: partners.id, name: partners.name, status: partners.status })
    .from(partners)
    .where(eq(partners.id, id))
    .limit(1)

  if (!existing) {
    throw notFound('No encontramos este aliado.')
  }

  const patch: Partial<typeof partners.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (body.name !== undefined) patch.name = body.name
  if (body.type !== undefined) patch.type = body.type
  if (body.currency !== undefined) patch.currency = body.currency
  if (body.status !== undefined) patch.status = body.status
  if (body.profitWarehouseCode !== undefined) {
    patch.profitWarehouseCode = nullable(body.profitWarehouseCode)
  }
  if (body.contactName !== undefined) patch.contactName = nullable(body.contactName)
  if (body.contactPhone !== undefined) patch.contactPhone = nullable(body.contactPhone)
  if (body.contactEmail !== undefined) patch.contactEmail = nullable(body.contactEmail)
  if (body.notes !== undefined) patch.notes = nullable(body.notes)

  await db.update(partners).set(patch).where(eq(partners.id, id))

  if (body.status && body.status !== existing.status) {
    const partnerUsers = await db.select({ id: user.id }).from(user).where(eq(user.partnerId, id))

    if (body.status === 'inactive') {
      if (partnerUsers.length > 0) {
        await db
          .update(user)
          .set({
            banned: true,
            banReason: PARTNER_INACTIVE_REASON,
            banExpires: null,
            updatedAt: new Date(),
          })
          .where(and(eq(user.partnerId, id), eq(user.banned, false)))

        await db.delete(sessionTable).where(
          inArray(
            sessionTable.userId,
            partnerUsers.map((row) => row.id),
          ),
        )
      }
    } else {
      await db
        .update(user)
        .set({
          banned: false,
          banReason: null,
          banExpires: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(user.partnerId, id),
            eq(user.banned, true),
            eq(user.banReason, PARTNER_INACTIVE_REASON),
          ),
        )
    }
  }

  await writeAudit(c, {
    action: 'partners.update',
    entityType: 'partner',
    entityId: id,
    partnerId: id,
    description: `Actualizó el aliado ${body.name ?? existing.name}.`,
    metadata: body,
  })

  return c.json({ data: await findPartner(db, id) })
})
