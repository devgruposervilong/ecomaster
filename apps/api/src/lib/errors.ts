import type { ContentfulStatusCode } from 'hono/utils/http-status'

export class AppError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: string
  readonly details?: unknown

  constructor(status: ContentfulStatusCode, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function badRequest(message: string, details?: unknown) {
  return new AppError(400, 'BAD_REQUEST', message, details)
}

export function unauthorized(message = 'Debes iniciar sesión para continuar.') {
  return new AppError(401, 'UNAUTHORIZED', message)
}

export function forbidden(message = 'No tienes permisos para realizar esta acción.') {
  return new AppError(403, 'FORBIDDEN', message)
}

export function notFound(message = 'No encontramos el recurso solicitado.') {
  return new AppError(404, 'NOT_FOUND', message)
}

export function conflict(message: string, details?: unknown) {
  return new AppError(409, 'CONFLICT', message, details)
}

export function unprocessable(message: string, details?: unknown) {
  return new AppError(422, 'UNPROCESSABLE_ENTITY', message, details)
}

export function internal(message = 'Ocurrió un error inesperado.') {
  return new AppError(500, 'INTERNAL_ERROR', message)
}
