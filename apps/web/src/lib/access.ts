import { hasModuleAccess, type ModuleKey } from '@ecomaster/shared'
import type { Me } from './queries'

const MODULE_PATHS: Array<{ path: string; module: ModuleKey }> = [
  { path: '/', module: 'dashboard' },
  { path: '/ventas', module: 'sales' },
  { path: '/catalogo', module: 'catalog' },
  { path: '/inventario', module: 'inventory' },
  { path: '/finanzas', module: 'finance' },
  { path: '/reportes', module: 'reports' },
  { path: '/tienda', module: 'store' },
]

/** Módulo que protege una ruta, o null si la ruta no depende de un módulo. */
export function moduleForPath(pathname: string): ModuleKey | null {
  const match = MODULE_PATHS.find((entry) =>
    entry.path === '/' ? pathname === '/' : pathname === entry.path || pathname.startsWith(`${entry.path}/`),
  )
  return match?.module ?? null
}

export function canAccessPath(me: Me, pathname: string) {
  if (pathname === '/ajustes' || pathname.startsWith('/ajustes/')) return true

  // Aliados y usuarios siguen siendo exclusivos del administrador global.
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return me.user.role === 'admin'
  }

  const module = moduleForPath(pathname)
  if (!module) return true

  return hasModuleAccess(me.user.role, me.user.modules, module)
}

/** Primera ruta permitida para un usuario sin acceso a la página solicitada. */
export function firstAllowedPath(me: Me) {
  if (canAccessPath(me, '/')) return '/'
  if (canAccessPath(me, '/ventas')) return '/ventas'
  if (canAccessPath(me, '/catalogo')) return '/catalogo'
  if (canAccessPath(me, '/inventario')) return '/inventario'
  if (canAccessPath(me, '/finanzas')) return '/finanzas'
  if (canAccessPath(me, '/reportes')) return '/reportes'
  if (canAccessPath(me, '/tienda')) return '/tienda'
  return '/ajustes'
}
