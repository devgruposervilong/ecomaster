import { and, is, SQL, Table } from 'drizzle-orm'
import type { SQL as SQLType } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import type { Db } from '../index'
import * as schema from '../schema'
import {
  assertOperation,
  buildTenantPredicate,
  insertModeFor,
  resolveTablePolicy,
  type TablePolicy,
  type TenancyOperation,
} from './registry'
import { TenancyError, type TenantScope } from './scope'

// El wrapper inspecciona builders dinámicos de Drizzle; `any` queda acotado a
// este módulo y no se expone en la API pública.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<PropertyKey, any>

type ScopedMeta = {
  finalize: () => object
}

const scopedMeta = new WeakMap<object, ScopedMeta>()

const JOIN_METHODS = new Set(['leftJoin', 'innerJoin', 'rightJoin', 'fullJoin'])
const SUBQUERY_METHODS = new Set(['union', 'unionAll', 'intersect', 'except', 'as'])
const PREPARE_METHODS = new Set(['prepare', '_prepare'])
const INTERNAL_PROPS = new Set(['session', 'dialect', 'config', '_'])
const TERMINAL_METHODS = new Set([
  'then',
  'catch',
  'finally',
  'all',
  'get',
  'run',
  'values',
  'execute',
  'toSQL',
  'getSQL',
])

function markScoped<T extends object>(proxy: T, finalize: () => object): T {
  scopedMeta.set(proxy, { finalize })
  return proxy
}

function guardInternalProps(prop: PropertyKey) {
  if (INTERNAL_PROPS.has(prop as string)) {
    throw new TenancyError(
      'RAW_SQL_FORBIDDEN',
      `"${String(prop)}" es una propiedad interna y no está disponible en el scope de tenancy.`,
    )
  }
}

/**
 * Envuelve un cliente Drizzle con el scope de la request.
 *
 * Es genérico a propósito: la app usa D1, pero los tests pueden usar SQLite en
 * memoria. La única parte específica de D1 es `createScopedDb`.
 */
export function scopeDb<T extends object>(db: T, scope: TenantScope): T {
  return new Proxy(db, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (prop === 'select' || prop === 'selectDistinct') {
        return (...args: unknown[]) => {
          const builder = (target as AnyRecord)[prop] as (...input: unknown[]) => object
          return wrapSelectBuilder(builder.apply(target, args), scope)
        }
      }

      if (prop === 'insert' || prop === 'update' || prop === 'delete') {
        return (table: Table) => {
          const operation = prop as TenancyOperation
          const { policy } = resolveTablePolicy(table)
          assertOperation(policy, scope, operation)

          const builder = (target as AnyRecord)[prop] as (input: Table) => object
          const created = builder.call(target, table)

          if (operation === 'insert') return wrapInsertBuilder(created, policy, scope)
          if (operation === 'update') return wrapUpdateBuilder(created, table, policy, scope)
          return wrapWriteBase(created, table, policy, scope)
        }
      }

      if (prop === 'batch') {
        return (queries: unknown[]) => {
          const batch = (target as AnyRecord).batch

          if (typeof batch !== 'function') {
            throw new TenancyError('UNSCOPED_BATCH', 'Este driver no soporta batch().')
          }

          if (!Array.isArray(queries) || queries.length === 0) {
            throw new TenancyError(
              'UNSCOPED_BATCH',
              'batch() requiere queries construidas con el wrapper de tenancy.',
            )
          }

          const finalized = queries.map((query) => {
            const meta = scopedMeta.get(query as object)

            if (!meta) {
              throw new TenancyError(
                'UNSCOPED_BATCH',
                'batch() solo acepta queries construidas con el wrapper de tenancy.',
              )
            }

            return meta.finalize()
          })

          return batch.call(target, finalized)
        }
      }

      if (prop === 'transaction') {
        return () => {
          throw new TenancyError(
            'TRANSACTION_UNSUPPORTED',
            'D1 no soporta transacciones interactivas. Usa db.batch() para operaciones atómicas.',
          )
        }
      }

      if (
        prop === 'run' ||
        prop === 'all' ||
        prop === 'get' ||
        prop === 'values' ||
        prop === 'execute'
      ) {
        return () => {
          throw new TenancyError(
            'RAW_SQL_FORBIDDEN',
            'El SQL crudo no está permitido en el scope de tenancy.',
          )
        }
      }

      if (
        prop === '$client' ||
        prop === '$primary' ||
        prop === '$replicas' ||
        prop === '$cache' ||
        prop === 'query' ||
        prop === '$count' ||
        prop === '$with' ||
        prop === 'with' ||
        prop === 'session' ||
        prop === 'dialect' ||
        prop === '_'
      ) {
        throw new TenancyError(
          'RAW_SQL_FORBIDDEN',
          `"${String(prop)}" no está permitido en el scope de tenancy.`,
        )
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

export function createScopedDb(client: D1Database, scope: TenantScope): Db {
  return scopeDb(drizzle(client, { schema }), scope) as unknown as Db
}

function wrapSelectBuilder(builder: object, scope: TenantScope): object {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (prop === 'from') {
        return (source: unknown) => {
          const from = (target as AnyRecord).from as (input: unknown) => object
          return wrapSelectBase(from.call(target, source), source, scope)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function wrapSelectBase(builder: object, source: unknown, scope: TenantScope): object {
  const predicate = predicateForSource(source, scope, 'select')
  let combinedWhere: SQLType | undefined
  let whereApplied = false

  const finalize = () => {
    if (predicate && !whereApplied) {
      ;(builder as AnyRecord).where.call(builder, predicate)
      whereApplied = true
    }

    return builder
  }

  const proxy: object = new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (prop === 'where') {
        return (condition: unknown) => {
          if (condition === undefined) return proxy

          if (typeof condition === 'function') {
            if (predicate) {
              throw new TenancyError(
                'FUNCTION_WHERE_UNSUPPORTED',
                'En scope partner, usa condiciones SQL en where(); las funciones no se pueden inspeccionar.',
              )
            }

            ;(target as AnyRecord).where.call(target, condition)
            whereApplied = true
            return proxy
          }

          combinedWhere = combinedWhere
            ? and(combinedWhere, condition as SQLType)
            : (condition as SQLType)

          ;(target as AnyRecord).where.call(
            target,
            predicate ? and(predicate, combinedWhere) : combinedWhere,
          )
          whereApplied = true
          return proxy
        }
      }

      if (PREPARE_METHODS.has(prop as string)) {
        throw new TenancyError(
          'RAW_SQL_FORBIDDEN',
          'prepare()/_prepare() no están permitidos en el scope de tenancy.',
        )
      }

      if (
        SUBQUERY_METHODS.has(prop as string) &&
        (scope.kind === 'partner' || scope.kind === 'deny')
      ) {
        throw new TenancyError(
          'OPERATION_NOT_ALLOWED',
          'union/intersect/except/as no están permitidos en el scope de un aliado.',
        )
      }

      if (JOIN_METHODS.has(prop as string)) {
        return (table: unknown, on: unknown) =>
          applyJoin(target, prop as string, table, on, scope, proxy)
      }

      if (prop === 'crossJoin') {
        return (table: unknown) => {
          if (is(table, Table)) {
            const { policy } = resolveTablePolicy(table)
            assertOperation(policy, scope, 'select')

            if (scope.kind === 'partner' && policy.kind === 'tenant') {
              throw new TenancyError(
                'OPERATION_NOT_ALLOWED',
                'crossJoin sobre una tabla tenant no está permitido en scope partner.',
              )
            }
          } else if (scope.kind === 'partner' || scope.kind === 'deny') {
            throw new TenancyError(
              'TABLE_NOT_CLASSIFIED',
              'Solo se permiten tablas clasificadas en el scope de un aliado.',
            )
          }

          const result = (target as AnyRecord).crossJoin.call(target, table)
          return result === target ? proxy : result
        }
      }

      if (TERMINAL_METHODS.has(prop as string)) {
        return (...args: unknown[]) => {
          finalize()
          return (target as AnyRecord)[prop as string].apply(target, args)
        }
      }

      const value = Reflect.get(target, prop, receiver)

      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = value.apply(target, args)
          return result === target ? proxy : result
        }
      }

      return value
    },
  })

  return markScoped(proxy, finalize)
}

function applyJoin(
  target: object,
  method: string,
  table: unknown,
  on: unknown,
  scope: TenantScope,
  proxy: object,
) {
  let nextOn = on

  if (is(table, Table)) {
    const { policy } = resolveTablePolicy(table)
    assertOperation(policy, scope, 'select')

    const joinPredicate = buildTenantPredicate(table, policy, scope)

    if (joinPredicate) {
      if (typeof nextOn === 'function') {
        throw new TenancyError(
          'FUNCTION_WHERE_UNSUPPORTED',
          'En scope partner, usa condiciones SQL en los joins; las funciones no se pueden inspeccionar.',
        )
      }

      nextOn = and(nextOn as SQLType, joinPredicate)
    }
  } else if (scope.kind === 'partner' || scope.kind === 'deny') {
    throw new TenancyError(
      'TABLE_NOT_CLASSIFIED',
      'Solo se permiten tablas clasificadas en el scope de un aliado.',
    )
  }

  const result = (target as AnyRecord)[method].call(target, table, nextOn)
  return result === target ? proxy : result
}

function predicateForSource(
  source: unknown,
  scope: TenantScope,
  operation: TenancyOperation,
): SQLType | undefined {
  if (is(source, Table)) {
    const { policy } = resolveTablePolicy(source)
    assertOperation(policy, scope, operation)
    return buildTenantPredicate(source, policy, scope)
  }

  if (scope.kind === 'partner' || scope.kind === 'deny') {
    throw new TenancyError(
      'TABLE_NOT_CLASSIFIED',
      'Solo se permiten tablas clasificadas en el scope de un aliado.',
    )
  }

  return undefined
}

function wrapInsertBuilder(builder: object, policy: TablePolicy, scope: TenantScope): object {
  const proxy: object = new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (prop === 'values') {
        return (values: unknown) => {
          const injected = injectPartnerValues(policy, scope, values)
          const result = (target as AnyRecord).values.call(target, injected)
          return wrapInsertBase(result, policy, scope)
        }
      }

      if (prop === 'select') {
        return (selectQuery: unknown) => {
          if (scope.kind === 'partner' && policy.kind === 'tenant') {
            throw new TenancyError(
              'PARTNER_ID_REQUIRED',
              'insert-select no está permitido en scope partner.',
            )
          }

          const result = (target as AnyRecord).select.call(target, selectQuery)
          return wrapInsertBase(result, policy, scope)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })

  return proxy
}

function wrapInsertBase(builder: object, policy: TablePolicy, scope: TenantScope): object {
  const finalize = () => builder

  const proxy: object = new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (PREPARE_METHODS.has(prop as string)) {
        throw new TenancyError(
          'RAW_SQL_FORBIDDEN',
          'prepare()/_prepare() no están permitidos en el scope de tenancy.',
        )
      }

      if (prop === 'onConflictDoUpdate') {
        return (config: unknown) => {
          if (policy.kind === 'tenant' && scope.kind === 'partner') {
            throw new TenancyError(
              'OPERATION_NOT_ALLOWED',
              'onConflictDoUpdate no está permitido en scope partner: el update podría tocar otra fila.',
            )
          }

          const result = (target as AnyRecord).onConflictDoUpdate.call(target, config)
          return result === target ? proxy : result
        }
      }

      if (TERMINAL_METHODS.has(prop as string)) {
        return (...args: unknown[]) => {
          finalize()
          return (target as AnyRecord)[prop as string].apply(target, args)
        }
      }

      const value = Reflect.get(target, prop, receiver)

      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = value.apply(target, args)
          return result === target ? proxy : result
        }
      }

      return value
    },
  })

  return markScoped(proxy, finalize)
}

function wrapUpdateBuilder(
  builder: object,
  table: Table,
  policy: TablePolicy,
  scope: TenantScope,
): object {
  return new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)

      if (prop === 'set') {
        return (values: unknown) => {
          validateUpdateValues(policy, scope, values)
          const result = (target as AnyRecord).set.call(target, values)
          return wrapWriteBase(result, table, policy, scope)
        }
      }

      const value = Reflect.get(target, prop, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  })
}

function wrapWriteBase(
  builder: object,
  table: Table,
  policy: TablePolicy,
  scope: TenantScope,
): object {
  const predicate = buildTenantPredicate(table, policy, scope)
  let combinedWhere: SQLType | undefined
  let whereApplied = false

  const requireWhere = policy.requireWhereOnWrite ?? true

  const guardPrepare = (prop: PropertyKey) => {
    if (PREPARE_METHODS.has(prop as string)) {
      throw new TenancyError(
        'RAW_SQL_FORBIDDEN',
        'prepare()/_prepare() no están permitidos en el scope de tenancy.',
      )
    }
  }

  const finalize = () => {
    if (whereApplied) return builder

    if (requireWhere) {
      throw new TenancyError(
        'MISSING_WHERE',
        'update()/delete() requiere un where() explícito en tablas de negocio.',
      )
    }

    if (predicate) {
      ;(builder as AnyRecord).where.call(builder, predicate)
      whereApplied = true
    }

    return builder
  }

  const proxy: object = new Proxy(builder, {
    get(target, prop, receiver) {
      guardInternalProps(prop)
      guardPrepare(prop)

      if (prop === 'where') {
        return (condition: unknown) => {
          if (condition === undefined) return proxy

          if (typeof condition === 'function') {
            if (predicate) {
              throw new TenancyError(
                'FUNCTION_WHERE_UNSUPPORTED',
                'En scope partner, usa condiciones SQL en where(); las funciones no se pueden inspeccionar.',
              )
            }

            ;(target as AnyRecord).where.call(target, condition)
            whereApplied = true
            return proxy
          }

          combinedWhere = combinedWhere
            ? and(combinedWhere, condition as SQLType)
            : (condition as SQLType)

          ;(target as AnyRecord).where.call(
            target,
            predicate ? and(predicate, combinedWhere) : combinedWhere,
          )
          whereApplied = true
          return proxy
        }
      }

      if (TERMINAL_METHODS.has(prop as string)) {
        return (...args: unknown[]) => {
          finalize()
          return (target as AnyRecord)[prop as string].apply(target, args)
        }
      }

      const value = Reflect.get(target, prop, receiver)

      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = value.apply(target, args)
          return result === target ? proxy : result
        }
      }

      return value
    },
  })

  return markScoped(proxy, finalize)
}

function injectPartnerValues(policy: TablePolicy, scope: TenantScope, values: unknown): unknown {
  const mode = insertModeFor(policy, scope)
  if (mode === 'none') return values
  if (policy.kind !== 'tenant') return values

  if (policy.columnKey !== 'partnerId') {
    throw new TenancyError(
      'INVALID_POLICY',
      `La inyección automática solo soporta partnerId; la tabla usa "${policy.columnKey}".`,
    )
  }

  const inject = (value: unknown): unknown => {
    if (is(value, SQL)) {
      throw new TenancyError(
        'PARTNER_ID_REQUIRED',
        'insert-select no está permitido en tablas con partner_id.',
      )
    }

    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new TenancyError('PARTNER_ID_REQUIRED', 'Cada fila del insert debe ser un objeto.')
    }

    const record = value as Record<string, unknown>

    if (mode === 'force') {
      if (scope.kind !== 'partner') {
        throw new TenancyError('INVALID_POLICY', 'El modo force requiere scope partner.')
      }

      if (record.partnerId !== undefined && record.partnerId !== scope.partnerId) {
        throw new TenancyError('CROSS_TENANT_WRITE', 'No puedes escribir filas de otro aliado.')
      }

      return { ...record, partnerId: scope.partnerId }
    }

    if (mode === 'require') {
      if (record.partnerId === undefined || record.partnerId === null || record.partnerId === '') {
        throw new TenancyError(
          'PARTNER_ID_REQUIRED',
          'El insert debe incluir partnerId en este scope.',
        )
      }
    }

    return record
  }

  return Array.isArray(values) ? values.map(inject) : inject(values)
}

function validateUpdateValues(policy: TablePolicy, scope: TenantScope, values: unknown) {
  if (policy.kind !== 'tenant' || scope.kind !== 'partner') return

  if (is(values, SQL) || typeof values !== 'object' || values === null) {
    throw new TenancyError(
      'CROSS_TENANT_WRITE',
      'El set() de un aliado debe ser un objeto inspeccionable.',
    )
  }

  const record = values as Record<string, unknown>

  if (policy.columnKey in record && record[policy.columnKey] !== scope.partnerId) {
    throw new TenancyError('CROSS_TENANT_WRITE', 'No puedes cambiar el aliado de una fila.')
  }
}
