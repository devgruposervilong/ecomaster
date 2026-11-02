import { createMiddleware } from 'hono/factory'
import { isGlobalRole, isPartnerRole } from '@ecomaster/shared'
import { createScopedDb, type TenantScope } from '../db/tenancy'
import type { AppEnv, AuthSession } from '../env'

/**
 * Rutas públicas que necesitan acceso de sistema (no de un aliado):
 * setup inicial, aceptación/preview de invitación por token y webhooks
 * autenticados con HMAC.
 */
const SYSTEM_PATHS = [
  { prefix: '/api/setup', reason: 'setup' as const },
  { prefix: '/api/invites', reason: 'invite-accept' as const },
  { prefix: '/api/webhooks', reason: 'wink-webhook' as const },
]

function matchesPath(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`)
}

export function resolveTenantScope(path: string, session: AuthSession | null): TenantScope {
  const systemPath = SYSTEM_PATHS.find((entry) => matchesPath(path, entry.prefix))

  if (systemPath) {
    return { kind: 'system', reason: systemPath.reason }
  }

  if (!session) {
    return { kind: 'deny' }
  }

  if (isGlobalRole(session.user.role)) {
    return { kind: 'admin' }
  }

  if (isPartnerRole(session.user.role) && session.user.partnerId) {
    return { kind: 'partner', partnerId: session.user.partnerId }
  }

  return { kind: 'deny' }
}

export const tenantMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const scope = resolveTenantScope(c.req.path, c.get('session'))

  c.set('tenantScope', scope)
  c.set('db', createScopedDb(c.env.DB, scope))

  await next()
})
