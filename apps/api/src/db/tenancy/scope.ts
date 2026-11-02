/**
 * Contexto de tenancy de una request.
 *
 * - `admin`: acceso global (solo usuarios con rol admin).
 * - `partner`: acceso limitado a las filas de un aliado.
 * - `system`: operaciones internas acotadas (setup y aceptar invitación).
 * - `deny`: falla cerrado; cualquier acceso a datos lanza error.
 *
 * El scope nunca se deriva de un parámetro del cliente: sale de la sesión o
 * de una ruta pública explícitamente permitida.
 */
export type TenantScope =
  | { kind: 'admin' }
  | { kind: 'partner'; partnerId: string }
  | { kind: 'system'; reason: 'setup' | 'invite-accept' }
  | { kind: 'deny' }

export type TenantScopeKind = TenantScope['kind']

export type TenancyErrorCode =
  | 'SCOPE_DENIED'
  | 'TABLE_NOT_CLASSIFIED'
  | 'OPERATION_NOT_ALLOWED'
  | 'CROSS_TENANT_WRITE'
  | 'PARTNER_ID_REQUIRED'
  | 'MISSING_WHERE'
  | 'RAW_SQL_FORBIDDEN'
  | 'UNSCOPED_BATCH'
  | 'TRANSACTION_UNSUPPORTED'
  | 'FUNCTION_WHERE_UNSUPPORTED'
  | 'INVALID_POLICY'

/**
 * Error de programación del aislamiento. No se expone al cliente: se registra
 * y se responde 500 para no filtrar detalles internos.
 */
export class TenancyError extends Error {
  readonly code: TenancyErrorCode

  constructor(code: TenancyErrorCode, message: string) {
    super(message)
    this.name = 'TenancyError'
    this.code = code
  }
}

export function isPartnerScope(
  scope: TenantScope,
): scope is { kind: 'partner'; partnerId: string } {
  return scope.kind === 'partner' && scope.partnerId.length > 0
}
