import { and, count, desc, eq, gt, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { DashboardSummary } from '@tools/shared'
import { auditLogs, invites, partners, user } from '../db/schema'
import type { AppEnv } from '../env'
import { lastNDates, todayLabel } from '../lib/dates'

export const dashboardRoutes = new Hono<AppEnv>()

dashboardRoutes.get('/summary', async (c) => {
  const db = c.get('db')
  const session = c.get('session')!
  const isAdmin = session.user.role === 'admin'
  const partnerId = session.user.partnerId
  const now = new Date()

  const [activePartnersRow] = isAdmin
    ? await db.select({ total: count() }).from(partners).where(eq(partners.status, 'active'))
    : await db
        .select({ total: count() })
        .from(partners)
        .where(
          and(
            eq(partners.status, 'active'),
            partnerId ? eq(partners.id, partnerId) : eq(partners.id, '__none__'),
          ),
        )

  const activeUserWhere = isAdmin
    ? eq(user.banned, false)
    : and(
        eq(user.banned, false),
        partnerId ? eq(user.partnerId, partnerId) : eq(user.id, '__none__'),
      )

  const [activeUsersRow] = await db.select({ total: count() }).from(user).where(activeUserWhere)

  const pendingWhere = and(
    isNull(invites.usedAt),
    isNull(invites.revokedAt),
    gt(invites.expiresAt, now),
    isAdmin ? undefined : partnerId ? eq(invites.partnerId, partnerId) : eq(invites.id, '__none__'),
  )

  const [pendingInvitesRow] = await db.select({ total: count() }).from(invites).where(pendingWhere)

  const activityWhere = isAdmin
    ? undefined
    : partnerId
      ? eq(auditLogs.partnerId, partnerId)
      : eq(auditLogs.id, '__none__')

  const activity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      description: auditLogs.description,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .where(activityWhere)
    .orderBy(desc(auditLogs.createdAt))
    .limit(8)

  const summary: DashboardSummary = {
    todayLabel: todayLabel(now),
    metrics: {
      salesToday: 0,
      unitsToday: 0,
      activePartners: Number(activePartnersRow?.total ?? 0),
      activeUsers: Number(activeUsersRow?.total ?? 0),
      pendingInvites: Number(pendingInvitesRow?.total ?? 0),
    },
    salesSeries: lastNDates(7, now).map((day) => ({ ...day, value: 0 })),
    topProducts: [],
    topPartners: [],
    recentActivity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      description: entry.description,
      createdAt: entry.createdAt.toISOString(),
    })),
  }

  return c.json({ data: summary })
})
