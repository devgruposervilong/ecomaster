import { eq, getTableName, Table } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { account, session, user, verification } from '../schema/auth.generated'
import { auditLogs } from '../schema/audit'
import { exchangeRates } from '../schema/exchange-rates'
import { healthchecks } from '../schema/health'
import { invites } from '../schema/invites'
import { partners } from '../schema/partners'
import { categories, productCategories } from '../schema/categories'
import { channels, channelPrices, priceHistory } from '../schema/channels'
import { productChannels } from '../schema/product-channels'
import { productComponents } from '../schema/product-components'
import { products } from '../schema/products'
import { saleItems, salePayments, sales } from '../schema/sales'
import { winkWebhookEvents } from '../schema/wink-events'
import { TenancyError, type TenantScope, type TenantScopeKind } from './scope'

export type TenancyOperation = 'select' | 'insert' | 'update' | 'delete'

/**
 * Cómo se completa `partner_id` en un insert:
 * - `force`: lo inyecta el wrapper con el partnerId de la sesión.
 * - `require`: el caller debe enviarlo explícitamente.
 * - `optional`: puede venir o quedar null (solo tablas donde el null es válido).
 * - `none`: la tabla no usa partner_id (por ejemplo, `partners`, cuyo tenant es `id`).
 */
export type InsertMode = 'force' | 'require' | 'optional' | 'none'

type Access = Partial<Record<TenantScopeKind, readonly TenancyOperation[]>>

type BasePolicy = {
  access: Access
  requireWhereOnWrite?: boolean
}

export type TenantTablePolicy = BasePolicy & {
  kind: 'tenant'
  columnKey: string
  insertPartner?: Partial<Record<TenantScopeKind, InsertMode>>
}

export type GlobalTablePolicy = BasePolicy & {
  kind: 'global'
}

export type TablePolicy = TenantTablePolicy | GlobalTablePolicy

const ALL: readonly TenancyOperation[] = ['select', 'insert', 'update', 'delete']

/**
 * Toda tabla del schema debe estar clasificada aquí. Si se agrega una tabla y
 * se olvida, `resolveTablePolicy` falla cerrado y el test de completitud
 * también falla.
 */
const TABLE_POLICIES: Record<string, TablePolicy> = {
  // El tenant de `partners` es la propia fila: un aliado solo ve su registro.
  [getTableName(partners)]: {
    kind: 'tenant',
    columnKey: 'id',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },

  // Los aliados no administran usuarios. Solo el admin y los flujos internos.
  [getTableName(user)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { admin: ALL, system: ['select', 'update', 'delete'] },
    insertPartner: { admin: 'optional', system: 'optional' },
    requireWhereOnWrite: true,
  },

  // Las invitaciones las crea exclusivamente el admin; el flujo público solo
  // lee y consume la invitación por token.
  [getTableName(invites)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { admin: ALL, system: ['select', 'update'] },
    insertPartner: { admin: 'optional', system: 'require' },
    requireWhereOnWrite: true,
  },

  // El aliado puede ver su actividad y dejar registro de sus acciones.
  [getTableName(auditLogs)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { partner: ['select', 'insert'], admin: ALL, system: ['insert'] },
    insertPartner: { partner: 'force', admin: 'optional', system: 'optional' },
    requireWhereOnWrite: true,
  },

  // Catálogo global: los aliados solo leen; el admin administra. El filtro por
  // canal de precios se hace en la ruta, no en tenancy (el catálogo no es
  // tenant).
  [getTableName(products)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(channels)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(channelPrices)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(productChannels)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(priceHistory)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(productComponents)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(categories)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(productCategories)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },

  // Ventas: cada aliado ve y registra las suyas. La anulación queda reservada
  // al admin en esta fase.
  [getTableName(sales)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { partner: ['select', 'insert'], admin: ALL, system: ['select'] },
    insertPartner: { partner: 'force', admin: 'require', system: 'require' },
    requireWhereOnWrite: true,
  },
  [getTableName(saleItems)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { partner: ['select', 'insert'], admin: ALL, system: ['select'] },
    insertPartner: { partner: 'force', admin: 'require', system: 'require' },
    requireWhereOnWrite: true,
  },
  [getTableName(salePayments)]: {
    kind: 'tenant',
    columnKey: 'partnerId',
    access: { partner: ['select', 'insert'], admin: ALL, system: ['select'] },
    insertPartner: { partner: 'force', admin: 'require', system: 'require' },
    requireWhereOnWrite: true,
  },

  // Webhooks de Wink: bitácora interna. El scope system recibe y procesa; el
  // admin solo consulta. Ningún aliado tiene acceso.
  [getTableName(winkWebhookEvents)]: {
    kind: 'global',
    access: { system: ['select', 'insert', 'update'], admin: ['select'] },
    requireWhereOnWrite: true,
  },

  // Plano de autenticación: nunca se expone a un partner.
  [getTableName(session)]: {
    kind: 'global',
    access: { admin: ALL },
    requireWhereOnWrite: true,
  },
  [getTableName(account)]: {
    kind: 'global',
    access: { admin: ALL },
    requireWhereOnWrite: true,
  },
  [getTableName(verification)]: {
    kind: 'global',
    access: { admin: ALL },
    requireWhereOnWrite: true,
  },

  // Datos compartidos por todos los aliados.
  [getTableName(exchangeRates)]: {
    kind: 'global',
    access: { partner: ['select'], admin: ALL, system: ['select'] },
    requireWhereOnWrite: true,
  },
  [getTableName(healthchecks)]: {
    kind: 'global',
    access: { admin: ALL },
    requireWhereOnWrite: true,
  },
}

export type ResolvedTablePolicy = {
  policy: TablePolicy
  tableName: string
}

const ORIGINAL_NAME = Symbol.for('drizzle:OriginalName')

export function resolveTablePolicy(table: Table): ResolvedTablePolicy {
  const originalName = (table as unknown as Record<PropertyKey, unknown>)[ORIGINAL_NAME]
  const tableName =
    typeof originalName === 'string' && originalName.length > 0 ? originalName : getTableName(table)

  const policy = TABLE_POLICIES[tableName]

  if (!policy) {
    throw new TenancyError(
      'TABLE_NOT_CLASSIFIED',
      `La tabla "${tableName}" no tiene una política de tenancy. Clasifícala en db/tenancy/registry.ts.`,
    )
  }

  return { policy, tableName }
}

export function assertOperation(
  policy: TablePolicy,
  scope: TenantScope,
  operation: TenancyOperation,
) {
  const allowed = policy.access[scope.kind]

  if (!allowed?.includes(operation)) {
    throw new TenancyError(
      'OPERATION_NOT_ALLOWED',
      `El scope "${scope.kind}" no puede ejecutar "${operation}" sobre esta tabla.`,
    )
  }
}

export function tenantColumn(table: Table, policy: TenantTablePolicy): AnySQLiteColumn {
  const column = (table as unknown as Record<string, unknown>)[policy.columnKey]

  if (!column) {
    throw new TenancyError(
      'INVALID_POLICY',
      `La política tenant espera la columna "${policy.columnKey}", pero no existe en la tabla.`,
    )
  }

  return column as AnySQLiteColumn
}

/**
 * Condición que se agrega a cada consulta de un aliado. Para admin/system no
 * hay condición automática: esas rutas son globales por diseño.
 */
export function buildTenantPredicate(
  table: Table,
  policy: TablePolicy,
  scope: TenantScope,
): SQL | undefined {
  if (scope.kind !== 'partner' || policy.kind !== 'tenant') return undefined

  return eq(tenantColumn(table, policy), scope.partnerId)
}

export function insertModeFor(policy: TablePolicy, scope: TenantScope): InsertMode {
  if (policy.kind !== 'tenant') return 'none'
  return policy.insertPartner?.[scope.kind] ?? 'none'
}
