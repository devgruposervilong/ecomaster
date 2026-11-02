import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { modulesForRole } from '@ecomaster/shared'
import { partners } from '../db/schema'
import type { AppEnv } from '../env'

export const meRoutes = new Hono<AppEnv>()

meRoutes.get('/', async (c) => {
  const session = c.get('session')!
  const db = c.get('db')

  const partner = session.user.partnerId
    ? ((
        await db
          .select({
            id: partners.id,
            name: partners.name,
            type: partners.type,
            currency: partners.currency,
            priceListId: partners.priceListId,
            status: partners.status,
          })
          .from(partners)
          .where(eq(partners.id, session.user.partnerId))
          .limit(1)
      )[0] ?? null)
    : null

  const role = session.user.role ?? 'partner_collaborator'

  return c.json({
    data: {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role,
        partnerId: session.user.partnerId ?? null,
        modules: modulesForRole(role, session.user.moduleAccess),
        image: session.user.image ?? null,
      },
      partner,
    },
  })
})
