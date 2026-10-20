import { and, count, desc, eq, gt, isNotNull, isNull, like, lte } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import { Hono } from 'hono'
import {
  acceptInviteSchema,
  createInviteSchema,
  listInvitesQuerySchema,
  type InviteRow,
} from '@tools/shared'
import { createAuth } from '../auth/auth'
import { invites, partners, user } from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { authErrorResponse, jsonWithAuthCookies } from '../lib/auth-response'
import { addDays } from '../lib/dates'
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { hashToken, newId, randomToken } from '../lib/ids'
import { jsonBody, queryParams } from '../lib/validation'

export const adminInviteRoutes = new Hono<AppEnv>()
export const publicInviteRoutes = new Hono<AppEnv>()

type InviteWithPartner = {
  id: string
  email: string
  partnerId: string
  partnerName: string
  role: InviteRow['role']
  expiresAt: Date
  usedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  createdByName: string | null
}

function inviteStatus(invite: InviteWithPartner): InviteRow['status'] {
  if (invite.usedAt) return 'used'
  if (invite.revokedAt) return 'revoked'
  if (invite.expiresAt.getTime() <= Date.now()) return 'expired'
  return 'pending'
}

function serializeInvite(invite: InviteWithPartner): InviteRow {
  return {
    id: invite.id,
    email: invite.email,
    partnerId: invite.partnerId,
    partnerName: invite.partnerName,
    role: invite.role,
    status: inviteStatus(invite),
    expiresAt: invite.expiresAt.toISOString(),
    usedAt: invite.usedAt?.toISOString() ?? null,
    createdAt: invite.createdAt.toISOString(),
    createdByName: invite.createdByName,
  }
}

function buildInviteUrl(c: { env: AppEnv['Bindings']; req: { url: string } }, token: string) {
  const origin = c.env.APP_URL || new URL(c.req.url).origin
  return `${origin.replace(/\/$/, '')}/invitacion/${token}`
}

adminInviteRoutes.get('/', queryParams(listInvitesQuerySchema), async (c) => {
  const { status, partnerId, search, page, pageSize } = c.req.valid('query')
  const db = c.get('db')
  const now = new Date()
  const creator = alias(user, 'creator')

  const conditions = []
  if (partnerId) conditions.push(eq(invites.partnerId, partnerId))
  if (search) conditions.push(like(invites.email, `%${search}%`))

  if (status === 'pending') {
    conditions.push(isNull(invites.usedAt))
    conditions.push(isNull(invites.revokedAt))
    conditions.push(gt(invites.expiresAt, now))
  }
  if (status === 'used') {
    conditions.push(isNotNull(invites.usedAt))
  }
  if (status === 'revoked') {
    conditions.push(isNotNull(invites.revokedAt))
  }
  if (status === 'expired') {
    conditions.push(isNull(invites.usedAt))
    conditions.push(isNull(invites.revokedAt))
    conditions.push(lte(invites.expiresAt, now))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const [totalRow] = await db.select({ total: count() }).from(invites).where(where)

  const rows = await db
    .select({
      id: invites.id,
      email: invites.email,
      partnerId: invites.partnerId,
      partnerName: partners.name,
      role: invites.role,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      revokedAt: invites.revokedAt,
      createdAt: invites.createdAt,
      createdByName: creator.name,
    })
    .from(invites)
    .innerJoin(partners, eq(partners.id, invites.partnerId))
    .leftJoin(creator, eq(creator.id, invites.createdBy))
    .where(where)
    .orderBy(desc(invites.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const total = Number(totalRow?.total ?? 0)

  return c.json({
    data: rows.map(serializeInvite),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

adminInviteRoutes.post('/', jsonBody(createInviteSchema), async (c) => {
  const body = c.req.valid('json')
  const db = c.get('db')
  const session = c.get('session')!

  if (body.role === 'admin') {
    throw badRequest('Las invitaciones son para usuarios de aliados.')
  }

  const email = body.email.toLowerCase()
  const [partner] = await db
    .select({ id: partners.id, name: partners.name, status: partners.status })
    .from(partners)
    .where(eq(partners.id, body.partnerId))
    .limit(1)

  if (!partner) throw badRequest('El aliado seleccionado no existe.')
  if (partner.status !== 'active') {
    throw badRequest('El aliado está inactivo. Actívalo antes de invitar usuarios.')
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email))
    .limit(1)

  if (existingUser) {
    throw conflict('Ya existe una cuenta con este correo.')
  }

  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.email, email), isNull(invites.usedAt), isNull(invites.revokedAt)))

  const token = randomToken()
  const tokenHash = await hashToken(token)
  const id = newId()
  const expiresAt = addDays(new Date(), 7)

  await db.insert(invites).values({
    id,
    tokenHash,
    email,
    partnerId: body.partnerId,
    role: body.role,
    expiresAt,
    createdBy: session.user.id,
  })

  await writeAudit(c, {
    action: 'invites.create',
    entityType: 'invite',
    entityId: id,
    partnerId: body.partnerId,
    description: `Invitó a ${email} como ${body.role}.`,
    metadata: { email, role: body.role, expiresAt: expiresAt.toISOString() },
  })

  const invite: InviteWithPartner = {
    id,
    email,
    partnerId: body.partnerId,
    partnerName: partner.name,
    role: body.role,
    expiresAt,
    usedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    createdByName: session.user.name,
  }

  return c.json(
    {
      data: serializeInvite(invite),
      url: buildInviteUrl(c, token),
    },
    201,
  )
})

adminInviteRoutes.post('/:id/revoke', async (c) => {
  const id = c.req.param('id')
  const db = c.get('db')

  const [existing] = await db
    .select({
      id: invites.id,
      email: invites.email,
      usedAt: invites.usedAt,
      revokedAt: invites.revokedAt,
    })
    .from(invites)
    .where(eq(invites.id, id))
    .limit(1)

  if (!existing) throw notFound('No encontramos esta invitación.')
  if (existing.usedAt) {
    throw conflict('Esta invitación ya fue utilizada.')
  }

  if (!existing.revokedAt) {
    await db.update(invites).set({ revokedAt: new Date() }).where(eq(invites.id, id))

    await writeAudit(c, {
      action: 'invites.revoke',
      entityType: 'invite',
      entityId: id,
      description: `Revocó la invitación de ${existing.email}.`,
    })
  }

  return c.json({ data: { ok: true } })
})

publicInviteRoutes.get('/:token', async (c) => {
  const token = c.req.param('token')
  const tokenHash = await hashToken(token)
  const [invite] = await c
    .get('db')
    .select({
      email: invites.email,
      role: invites.role,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      revokedAt: invites.revokedAt,
      partnerName: partners.name,
      partnerStatus: partners.status,
    })
    .from(invites)
    .innerJoin(partners, eq(partners.id, invites.partnerId))
    .where(eq(invites.tokenHash, tokenHash))
    .limit(1)

  if (!invite) {
    throw notFound('La invitación no existe o el enlace es inválido.')
  }

  if (invite.partnerStatus !== 'active') {
    throw new AppError(
      410,
      'PARTNER_INACTIVE',
      'El aliado de esta invitación está inactivo. Pide acceso al administrador.',
    )
  }

  if (invite.usedAt) {
    throw conflict('Esta invitación ya fue utilizada. Inicia sesión.')
  }

  if (invite.revokedAt) {
    throw new AppError(410, 'INVITE_REVOKED', 'Esta invitación fue revocada.')
  }

  if (invite.expiresAt.getTime() <= Date.now()) {
    throw new AppError(
      410,
      'INVITE_EXPIRED',
      'Esta invitación venció. Pide un enlace nuevo al administrador.',
    )
  }

  return c.json({
    data: {
      email: invite.email,
      partnerName: invite.partnerName,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    },
  })
})

publicInviteRoutes.post('/:token/accept', jsonBody(acceptInviteSchema), async (c) => {
  const token = c.req.param('token')
  const tokenHash = await hashToken(token)
  const { name, password } = c.req.valid('json')
  const db = c.get('db')
  const now = new Date()

  const [invite] = await db
    .select({
      id: invites.id,
      email: invites.email,
      partnerId: invites.partnerId,
      partnerName: partners.name,
      role: invites.role,
      expiresAt: invites.expiresAt,
      usedAt: invites.usedAt,
      revokedAt: invites.revokedAt,
      partnerStatus: partners.status,
    })
    .from(invites)
    .innerJoin(partners, eq(partners.id, invites.partnerId))
    .where(eq(invites.tokenHash, tokenHash))
    .limit(1)

  if (!invite) {
    throw notFound('La invitación no existe o el enlace es inválido.')
  }

  if (invite.partnerStatus !== 'active') {
    throw new AppError(
      410,
      'PARTNER_INACTIVE',
      'El aliado de esta invitación está inactivo. Pide acceso al administrador.',
    )
  }

  if (invite.usedAt) {
    throw conflict('Esta invitación ya fue utilizada. Inicia sesión.')
  }

  if (invite.revokedAt) {
    throw new AppError(410, 'INVITE_REVOKED', 'Esta invitación fue revocada.')
  }

  if (invite.expiresAt.getTime() <= now.getTime()) {
    throw new AppError(
      410,
      'INVITE_EXPIRED',
      'Esta invitación venció. Pide un enlace nuevo al administrador.',
    )
  }

  const [existingUser] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, invite.email))
    .limit(1)

  if (existingUser) {
    throw conflict('Ya existe una cuenta con este correo. Inicia sesión.')
  }

  const [claimed] = await db
    .update(invites)
    .set({ usedAt: now })
    .where(
      and(
        eq(invites.id, invite.id),
        isNull(invites.usedAt),
        isNull(invites.revokedAt),
        gt(invites.expiresAt, now),
      ),
    )
    .returning({ id: invites.id })

  if (!claimed) {
    throw conflict('Esta invitación ya no está disponible.')
  }

  const auth = createAuth(c.env)
  let createdUserId: string | null = null

  try {
    const created = await auth.api.signUpEmail({
      body: { name, email: invite.email, password },
    })
    createdUserId = created.user.id

    await db
      .update(user)
      .set({
        role: invite.role,
        partnerId: invite.partnerId,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, created.user.id))

    await writeAudit(c, {
      actorId: created.user.id,
      partnerId: invite.partnerId,
      action: 'invites.accept',
      entityType: 'user',
      entityId: created.user.id,
      description: `${name} aceptó la invitación y se unió a ${invite.partnerName}.`,
      metadata: { inviteId: invite.id, role: invite.role },
    })

    const authResponse = await auth.api.signInEmail({
      body: { email: invite.email, password },
      asResponse: true,
    })

    return jsonWithAuthCookies(authResponse, {
      data: {
        user: {
          id: created.user.id,
          name,
          email: invite.email,
          role: invite.role,
          partnerId: invite.partnerId,
          partnerName: invite.partnerName,
        },
      },
    })
  } catch (error) {
    if (createdUserId) {
      await db.delete(user).where(eq(user.id, createdUserId))
    }
    await db.update(invites).set({ usedAt: null }).where(eq(invites.id, invite.id))

    if (error instanceof AppError) throw error
    const mapped = authErrorResponse(error)
    throw new AppError(mapped.status as AppError['status'], 'INVITE_ACCEPT_FAILED', mapped.message)
  }
})
