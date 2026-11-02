import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { hasModuleAccess, type ModuleKey } from '@ecomaster/shared'
import type { AppEnv } from '../env'

/**
 * Protege una ruta de API con un módulo habilitado para el usuario.
 *
 * `admin` y `partner_admin` tienen acceso total. Los colaboradores solo pasan
 * si el administrador les habilitó el módulo en su configuración individual.
 */
export function requireModule(module: ModuleKey) {
  return createMiddleware<AppEnv>(async (c, next) => {
    const session = c.get('session')

    if (!session) {
      throw new HTTPException(401, {
        message: 'Debes iniciar sesión para continuar.',
      })
    }

    if (!hasModuleAccess(session.user.role, session.user.moduleAccess, module)) {
      throw new HTTPException(403, {
        message: 'No tienes acceso a este módulo.',
      })
    }

    await next()
  })
}
