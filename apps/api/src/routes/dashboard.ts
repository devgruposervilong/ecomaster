import { and, count, desc, eq, gt, isNull } from 'drizzle-orm'
import { Hono } from 'hono'
import type { DashboardSummary } from '@ecomaster/shared'
import { auditLogs, invites, partners, user } from '../db/schema'
import type { AppEnv } from '../env'
import { lastNDates, todayLabel } from '../lib/dates'

export const dashboardRoutes = new Hono<AppEnv>()

dashboardRoutes.get('/summary', async (c) => {
  const db = c.get('db')
  const session = c.get('session')!
  const isAdmin = session.user.role === 'admin'
  const now = new Date()

  // El wrapper aplica el filtro del aliado automáticamente. Para admin no hay
  // filtro y estas mismas queries devuelven el agregado global.
  const [activePartnersRow] = await db
    .select({ total: count() })
    .from(partners)
    .where(eq(partners.status, 'active'))

  const [activeUsersRow] = isAdmin
    ? await db.select({ total: count() }).from(user).where(eq(user.banned, false))
    : [{ total: 0 }]

  const [pendingInvitesRow] = isAdmin
    ? await db
        .select({ total: count() })
        .from(invites)
        .where(and(isNull(invites.usedAt), isNull(invites.revokedAt), gt(invites.expiresAt, now)))
    : [{ total: 0 }]

  const activity = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      description: auditLogs.description,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
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
