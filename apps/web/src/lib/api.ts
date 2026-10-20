export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

type ErrorPayload = {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  const isFormData = init.body instanceof FormData

  if (init.body !== undefined && !isFormData && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }

  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers,
  })

  const contentType = response.headers.get('content-type') ?? ''
  const payload = contentType.includes('application/json')
    ? ((await response.json()) as T & ErrorPayload)
    : null

  if (!response.ok) {
    const error = payload?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'REQUEST_FAILED',
      error?.message ?? 'No pudimos completar la solicitud.',
      error?.details,
    )
  }

  return payload as T
}

export function jsonBody(value: unknown) {
  return JSON.stringify(value)
}

export function errorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return 'Ocurrió un error inesperado.'
}
