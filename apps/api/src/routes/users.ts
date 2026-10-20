import { and, count, desc, eq, like, or, sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { z } from 'zod'
import {
  listUsersQuerySchema,
  resetPasswordSchema,
  updateUserSchema,
  type UserRow,
} from '@tools/shared'
import { createAuth } from '../auth/auth'
import { partners, session as sessionTable, user } from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { jsonBody, queryParams } from '../lib/validation'

export const userRoutes = new Hono<AppEnv>()

const banSchema = z.object({
  reason: z.string().trim().max(300).optional().or(z.literal('')),
})

function iso(value: Date | number | string | null | undefined) {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'number') return new Date(value).toISOString()
  return value
}

function serializeUser(row: {
  id: string
  name: string
  email: string
  role: string | null
  partnerId: string | null
  partnerName: string | null
  banned: boolean | null
  emailVerified: boolean
  lastLoginAt: number | null
  createdAt: Date
}): UserRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: (row.role ?? 'partner_operator') as UserRow['role'],
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    status: row.banned ? 'suspended' : 'active',
    emailVerified: row.emailVerified,
    banned: Boolean(row.banned),
    lastLoginAt: iso(row.lastLoginAt),
    createdAt: row.createdAt.toISOString(),
  }
}

function userSelection() {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    partnerId: user.partnerId,
    partnerName: partners.name,
    banned: user.banned,
    emailVerified: user.emailVerified,
    lastLoginAt: sql<number | null>`(
      select max(${sessionTable.createdAt})
      from ${sessionTable}
      where ${sessionTable.userId} = ${user.id}
    )`,
    createdAt: user.createdAt,
  }
}

async function findUser(db: AppEnv['Variables']['db'], id: string) {
  const [row] = await db
    .select(userSelection())
    .from(user)
    .leftJoin(partners, eq(partners.id, user.partnerId))
    .where(eq(user.id, id))
    .limit(1)

  return row ? serializeUser(row) : null
}

async function countAdmins(db: AppEnv['Variables']['db'], excludeId?: string) {
  const where = excludeId
    ? and(eq(user.role, 'admin'), sql`${user.id} <> ${excludeId}`)
    : eq(user.role, 'admin')

  const [row] = await db.select({ total: count() }).from(user).where(where)
  return Number(row?.total ?? 0)
}

userRoutes.get('/', queryParams(listUsersQuerySchema), async (c) => {
  const { search, partnerId, role, status, page, pageSize } = c.req.valid('query')
  const db = c.get('db')

  const conditions = []
  if (search) {
    conditions.push(or(like(user.name, `%${search}%`), like(user.email, `%${search}%`)))
  }
  if (partnerId) conditions.push(eq(user.partnerId, partnerId))
  if (role) conditions.push(eq(user.role, role))
  if (status === 'active') conditions.push(eq(user.banned, false))
  if (status === 'suspended') conditions.push(eq(user.banned, true))
  if (status === 'invited') conditions.push(sql`0`)

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [totalRow] = await db.select({ total: count() }).from(user).where(where)

  const rows = await db
    .select(userSelection())
    .from(user)
    .leftJoin(partners, eq(partners.id, user.partnerId))
    .where(where)
    .orderBy(desc(user.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const total = Number(totalRow?.total ?? 0)

  return c.json({
    data: rows.map(serializeUser),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

userRoutes.patch('/:id', jsonBody(updateUserSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')
  const current = c.get('session')!.user

  const [existing] = await db
    .select({
      id: user.id,
      name: user.name,
      role: user.role,
      partnerId: user.partnerId,
    })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos este usuario.')

  const nextRole = body.role ?? existing.role ?? 'partner_operator'
  const nextPartnerId =
    nextRole === 'admin' ? null : body.partnerId !== undefined ? body.partnerId : existing.partnerId

  if (nextRole !== 'admin' && !nextPartnerId) {
    throw badRequest('Los usuarios de aliados deben tener un aliado asignado.')
  }

  if (id === current.id && nextRole !== 'admin') {
    throw badRequest('No puedes quitarte el rol de administrador.')
  }

  if (existing.role === 'admin' && nextRole !== 'admin') {
    const remaining = await countAdmins(db, id)
    if (remaining === 0) {
      throw conflict('Debe existir al menos un administrador.')
    }
  }

  if (nextPartnerId) {
    const [partner] = await db
      .select({ id: partners.id, status: partners.status })
      .from(partners)
      .where(eq(partners.id, nextPartnerId))
      .limit(1)

    if (!partner) throw badRequest('El aliado seleccionado no existe.')
    if (partner.status !== 'active' && nextPartnerId !== existing.partnerId) {
      throw conflict('El aliado seleccionado está inactivo.')
    }
  }

  await db
    .update(user)
    .set({
      name: body.name ?? existing.name,
      role: nextRole,
      partnerId: nextPartnerId,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))

  if (nextRole !== existing.role || nextPartnerId !== existing.partnerId) {
    await db.delete(sessionTable).where(eq(sessionTable.userId, id))
  }

  await writeAudit(c, {
    action: 'users.update',
    entityType: 'user',
    entityId: id,
    partnerId: nextPartnerId,
    description: `Actualizó el usuario ${body.name ?? existing.name}.`,
    metadata: { role: nextRole, partnerId: nextPartnerId },
  })

  return c.json({ data: await findUser(db, id) })
})

userRoutes.post('/:id/ban', jsonBody(banSchema), async (c) => {
  const id = c.req.param('id')
  const { reason } = c.req.valid('json')
  const db = c.get('db')
  const current = c.get('session')!.user

  if (id === current.id) {
    throw badRequest('No puedes suspender tu propia cuenta.')
  }

  const [existing] = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos este usuario.')

  if (existing.role === 'admin') {
    const remaining = await countAdmins(db, id)
    if (remaining === 0) {
      throw conflict('Debe existir al menos un administrador activo.')
    }
  }

  await db
    .update(user)
    .set({
      banned: true,
      banReason: reason || 'Suspendido por un administrador.',
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))

  await db.delete(sessionTable).where(eq(sessionTable.userId, id))

  await writeAudit(c, {
    action: 'users.ban',
    entityType: 'user',
    entityId: id,
    description: `Suspendió el usuario ${existing.name}.`,
    metadata: { reason: reason || null },
  })

  return c.json({ data: await findUser(db, id) })
})

userRoutes.post('/:id/unban', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const [existing] = await db
    .select({ id: user.id, name: user.name, partnerId: user.partnerId })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos este usuario.')

  if (existing.partnerId) {
    const [partner] = await db
      .select({ status: partners.status })
      .from(partners)
      .where(eq(partners.id, existing.partnerId))
      .limit(1)

    if (partner?.status === 'inactive') {
      throw conflict('El aliado está inactivo. Reactívalo antes de habilitar a sus usuarios.')
    }
  }

  await db
    .update(user)
    .set({
      banned: false,
      banReason: null,
      banExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, id))

  await writeAudit(c, {
    action: 'users.unban',
    entityType: 'user',
    entityId: id,
    description: `Reactivó el usuario ${existing.name}.`,
  })

  return c.json({ data: await findUser(db, id) })
})

userRoutes.post('/:id/password', jsonBody(resetPasswordSchema), async (c) => {
  const id = c.req.param('id')
  const { newPassword } = c.req.valid('json')
  const db = c.get('db')
  const auth = createAuth(c.env)

  const [existing] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos este usuario.')

  if (existing.id === c.get('session')!.user.id) {
    throw badRequest('Usa la opción de cambiar contraseña de tu perfil.')
  }

  try {
    await auth.api.setUserPassword({
      body: { userId: id, newPassword },
      headers: c.req.raw.headers,
    })
  } catch (error) {
    if (error instanceof AppError) throw error
    throw forbidden('No pudimos cambiar la contraseña de este usuario.')
  }

  await db.delete(sessionTable).where(eq(sessionTable.userId, id))

  await writeAudit(c, {
    action: 'users.reset_password',
    entityType: 'user',
    entityId: id,
    description: `Restableció la contraseña de ${existing.name}.`,
  })

  return c.json({ data: { ok: true } })
})

userRoutes.post('/:id/revoke-sessions', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const [existing] = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos este usuario.')

  await db.delete(sessionTable).where(eq(sessionTable.userId, id))

  await writeAudit(c, {
    action: 'users.revoke_sessions',
    entityType: 'user',
    entityId: id,
    description: `Revocó las sesiones de ${existing.name}.`,
  })

  return c.json({ data: { ok: true } })
})
