import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import type { AppEnv } from '../env'
import { createAuth } from './auth'

export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const auth = createAuth(c.env)
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  })
  c.set('session', session)
  await next()
})

export const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get('session')

  if (!session) {
    throw new HTTPException(401, {
      message: 'Debes iniciar sesión para continuar.',
    })
  }

  await next()
})

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get('session')

  if (!session) {
    throw new HTTPException(401, {
      message: 'Debes iniciar sesión para continuar.',
    })
  }

  if (session.user.role !== 'admin') {
    throw new HTTPException(403, {
      message: 'No tienes permisos para realizar esta acción.',
    })
  }

  await next()
})

export const requirePartner = createMiddleware<AppEnv>(async (c, next) => {
  const session = c.get('session')

  if (!session) {
    throw new HTTPException(401, {
      message: 'Debes iniciar sesión para continuar.',
    })
  }

  if (session.user.role === 'admin') {
    await next()
    return
  }

  if (!session.user.partnerId) {
    throw new HTTPException(403, {
      message: 'Tu usuario no está asociado a un aliado.',
    })
  }

  await next()
})
