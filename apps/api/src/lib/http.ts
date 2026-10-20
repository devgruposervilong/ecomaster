import type { Context } from 'hono'
import type { AppEnv } from '../env'

export function errorBody(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details }),
    },
  }
}

export function getSessionUser(c: Context<AppEnv>) {
  const session = c.get('session')
  if (!session) return null
  return session.user
}

export function requireSessionUser(c: Context<AppEnv>) {
  const user = getSessionUser(c)
  if (!user) {
    throw new Error('UNAUTHENTICATED')
  }
  return user
}

export function clientIp(c: Context<AppEnv>) {
  return c.req.header('cf-connecting-ip') ?? null
}

export function userAgent(c: Context<AppEnv>) {
  return c.req.header('user-agent') ?? null
}
