import { z } from 'zod'
import type { Role } from './common'

/**
 * Módulos que un administrador puede habilitar por usuario en los roles
 * colaboradores. Los módulos de administración (aliados y usuarios) quedan
 * reservados al rol `admin`.
 */
export const MODULE_KEYS = [
  'dashboard',
  'sales',
  'catalog',
  'inventory',
  'finance',
  'reports',
  'store',
] as const

export type ModuleKey = (typeof MODULE_KEYS)[number]

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: 'Inicio',
  sales: 'Ventas',
  catalog: 'Catálogo',
  inventory: 'Inventario',
  finance: 'Finanzas',
  reports: 'Reportes',
  store: 'Tienda online',
}

export const MODULE_DESCRIPTIONS: Record<ModuleKey, string> = {
  dashboard: 'Resumen, métricas y actividad del backoffice.',
  sales: 'Registro diario y cierres de ventas.',
  catalog: 'Productos, precios y categorías por aliado.',
  inventory: 'Stock actual y movimientos de inventario.',
  finance: 'Transferencias, comprobantes y deuda.',
  reports: 'Reportes operativos y financieros.',
  store: 'Publicación y administración de la tienda online.',
}

export const moduleSchema = z.enum(MODULE_KEYS)
export const modulesSchema = z.array(moduleSchema).max(MODULE_KEYS.length)

export const ALL_MODULES: ModuleKey[] = [...MODULE_KEYS]
export const DEFAULT_COLLABORATOR_MODULES: ModuleKey[] = ['dashboard', 'catalog']

export function isGlobalRole(role: string | null | undefined): role is 'admin' | 'collaborator' {
  return role === 'admin' || role === 'collaborator'
}

export function isPartnerRole(
  role: string | null | undefined,
): role is 'partner_admin' | 'partner_collaborator' {
  return role === 'partner_admin' || role === 'partner_collaborator'
}

export function isCollaboratorRole(
  role: string | null | undefined,
): role is 'collaborator' | 'partner_collaborator' {
  return role === 'collaborator' || role === 'partner_collaborator'
}

/** Convierte el JSON guardado en base de datos en una lista segura de módulos. */
export function parseModules(value: unknown): ModuleKey[] {
  let candidate = value

  if (typeof value === 'string') {
    try {
      candidate = JSON.parse(value)
    } catch {
      return []
    }
  }

  if (!Array.isArray(candidate)) return []

  const valid = new Set<string>(MODULE_KEYS)
  const modules = candidate.filter(
    (item): item is ModuleKey => typeof item === 'string' && valid.has(item),
  )

  return [...new Set(modules)]
}

/**
 * Los roles administrativos tienen acceso total. Los colaboradores usan su
 * configuración individual. Cualquier rol desconocido falla cerrado.
 */
export function modulesForRole(role: string | null | undefined, value: unknown): ModuleKey[] {
  if (role === 'admin' || role === 'partner_admin') return [...ALL_MODULES]
  if (isCollaboratorRole(role)) return parseModules(value)
  return []
}

export function hasModuleAccess(
  role: string | null | undefined,
  value: unknown,
  module: ModuleKey,
) {
  return modulesForRole(role, value).includes(module)
}
