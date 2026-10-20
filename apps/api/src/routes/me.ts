import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
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
            status: partners.status,
          })
          .from(partners)
          .where(eq(partners.id, session.user.partnerId))
          .limit(1)
      )[0] ?? null)
    : null

  return c.json({
    data: {
      user: {
        id: session.user.id,
        name: session.user.name,
        email: session.user.email,
        role: session.user.role ?? 'partner_operator',
        partnerId: session.user.partnerId ?? null,
        image: session.user.image ?? null,
      },
      partner,
    },
  })
})
