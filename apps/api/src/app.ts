import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { APIError } from 'better-auth'
import { createAuth } from './auth/auth'
import { requireAdmin, requirePartner, requireSession, sessionMiddleware } from './auth/middleware'
import { requireModule } from './auth/modules'
import { tenantMiddleware } from './auth/tenant'
import { createDb } from './db'
import { TenancyError } from './db/tenancy'
import type { AppEnv } from './env'
import { AppError } from './lib/errors'
import { errorBody } from './lib/http'
import { catalogRoutes } from './routes/catalog'
import { dashboardRoutes } from './routes/dashboard'
import { adminInviteRoutes, publicInviteRoutes } from './routes/invites'
import { meRoutes } from './routes/me'
import { partnerRoutes } from './routes/partners'
import { salesRoutes } from './routes/sales'
import { setupRoutes } from './routes/setup'
import { userRoutes } from './routes/users'

export const app = new Hono<AppEnv>()

app.onError((error, c) => {
  if (c.req.path.startsWith('/api')) {
    if (error instanceof AppError) {
      return c.json(errorBody(error.code, error.message, error.details), error.status)
    }

    if (error instanceof APIError) {
      const message = error.body?.message ?? 'No pudimos completar la operación con tu cuenta.'
      return c.json(errorBody('AUTH_ERROR', message), error.status as never)
    }

    if (error instanceof HTTPException) {
      return c.json(
        errorBody(
          error.status === 401 ? 'UNAUTHORIZED' : error.status === 403 ? 'FORBIDDEN' : 'HTTP_ERROR',
          error.message,
        ),
        error.status,
      )
    }

    if (error instanceof TenancyError) {
      console.error(`[tenancy:${error.code}]`, error)
      return c.json(
        errorBody(
          'TENANCY_ERROR',
          'Ocurrió un error interno de aislamiento de datos. Intenta de nuevo.',
        ),
        500,
      )
    }

    console.error(error)
    return c.json(
      errorBody('INTERNAL_ERROR', 'Ocurrió un error inesperado. Intenta de nuevo.'),
      500,
    )
  }

  console.error(error)
  return c.text('Internal Server Error', 500)
})

app.get('/api', (c) => c.json({ name: 'ecomaster-api', status: 'ok' }))

app.get('/api/health', async (c) => {
  const db = createDb(c.env.DB)
  const dbOk = await db
    .run(sql`SELECT 1`)
    .then(() => true)
    .catch(() => false)

  return c.json({ status: dbOk ? 'ok' : 'degraded', db: dbOk })
})

/**
 * El alta de cuentas es solo por invitación. Better Auth necesita la ruta de
 * sign-up para el flujo interno de setup/invitaciones, pero no debe quedar
 * expuesta al público.
 */
app.all('/api/auth/sign-up/*', (c) =>
  c.json(
    errorBody('SIGNUP_DISABLED', 'El registro está disponible solo mediante una invitación.'),
    403,
  ),
)

app.all('/api/auth/*', (c) => createAuth(c.env).handler(c.req.raw))

app.use('/api/*', sessionMiddleware)
app.use('/api/*', tenantMiddleware)

app.route('/api/setup', setupRoutes)
app.route('/api/invites', publicInviteRoutes)

app.use('/api/admin/*', requireAdmin)

app.route('/api/admin/users', userRoutes)
app.route('/api/admin/invites', adminInviteRoutes)
app.route('/api/admin/partners', partnerRoutes)

app.use('/api/catalog/*', requireSession, requirePartner, requireModule('catalog'))
app.use('/api/catalog', requireSession, requirePartner, requireModule('catalog'))
app.route('/api/catalog', catalogRoutes)

app.use('/api/dashboard/*', requireSession, requirePartner, requireModule('dashboard'))
app.route('/api/dashboard', dashboardRoutes)

app.use('/api/sales/*', requireSession, requirePartner, requireModule('sales'))
app.use('/api/sales', requireSession, requirePartner, requireModule('sales'))
app.route('/api/sales', salesRoutes)

app.use('/api/me/*', requireSession, requirePartner)
app.use('/api/me', requireSession, requirePartner)
app.route('/api/me', meRoutes)

app.notFound((c) => {
  if (c.req.path.startsWith('/api')) {
    return c.json(errorBody('NOT_FOUND', 'No encontramos esta ruta.'), 404)
  }
  return c.text('Not Found', 404)
})
