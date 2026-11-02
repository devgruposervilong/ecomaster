import { count, eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { setupSchema } from '@ecomaster/shared'
import { createAuth } from '../auth/auth'
import { user } from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { authErrorResponse, jsonWithAuthCookies } from '../lib/auth-response'
import { AppError, conflict, forbidden } from '../lib/errors'
import { jsonBody } from '../lib/validation'

export const setupRoutes = new Hono<AppEnv>()

async function adminCount(db: AppEnv['Variables']['db']) {
  const [row] = await db.select({ total: count() }).from(user).where(eq(user.role, 'admin'))

  return Number(row?.total ?? 0)
}

setupRoutes.get('/status', async (c) => {
  const total = await adminCount(c.get('db'))
  return c.json({ needsSetup: total === 0 })
})

setupRoutes.post('/', jsonBody(setupSchema), async (c) => {
  const { token, name, email, password } = c.req.valid('json')
  const env = c.env

  if (!env.SETUP_TOKEN) {
    throw new AppError(
      500,
      'SETUP_NOT_CONFIGURED',
      'El token de configuración no está definido en el servidor.',
    )
  }

  if (token !== env.SETUP_TOKEN) {
    throw forbidden('El token de configuración no es válido.')
  }

  if ((await adminCount(c.get('db'))) > 0) {
    throw conflict('Ya existe un administrador. Inicia sesión para continuar.')
  }

  const normalizedEmail = email.toLowerCase()
  const [existing] = await c
    .get('db')
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, normalizedEmail))
    .limit(1)

  if (existing) {
    throw conflict('Ya existe una cuenta con este correo.')
  }

  const auth = createAuth(env)
  let createdUserId: string | null = null

  try {
    const created = await auth.api.signUpEmail({
      body: { name, email: normalizedEmail, password },
    })
    createdUserId = created.user.id

    await c
      .get('db')
      .update(user)
      .set({
        role: 'admin',
        partnerId: null,
        emailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(user.id, created.user.id))

    await writeAudit(c, {
      actorId: created.user.id,
      partnerId: null,
      action: 'auth.setup',
      entityType: 'user',
      entityId: created.user.id,
      description: 'Creó la cuenta de administrador inicial.',
    })

    const authResponse = await auth.api.signInEmail({
      body: { email: normalizedEmail, password },
      asResponse: true,
    })

    return jsonWithAuthCookies(authResponse, {
      data: {
        user: {
          id: created.user.id,
          name,
          email: normalizedEmail,
          role: 'admin',
        },
      },
    })
  } catch (error) {
    if (createdUserId) {
      await c.get('db').delete(user).where(eq(user.id, createdUserId))
    }
    if (error instanceof AppError) throw error
    const mapped = authErrorResponse(error)
    throw new AppError(mapped.status as AppError['status'], 'SETUP_FAILED', mapped.message)
  }
})
