/**
 * Metadatos que extraemos del payload de Wink sin interpretar la venta.
 *
 * En esta fase solo necesitamos saber qué evento llegó y a qué venta externa
 * pertenece. El payload completo queda guardado tal cual para la unificación
 * posterior con `sales`.
 */

export type WinkEventMetadata = {
  event: string
  externalSaleId: string | null
  externalUpdatedAt: Date | null
  valid: boolean
  error: string | null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function parseDate(value: unknown): Date | null {
  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  return null
}

function parseSaleId(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }

  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  return null
}

export function extractWinkEventMetadata(payload: unknown): WinkEventMetadata {
  const root = asRecord(payload)

  if (!root) {
    return {
      event: 'unknown',
      externalSaleId: null,
      externalUpdatedAt: null,
      valid: false,
      error: 'El payload no es un objeto JSON.',
    }
  }

  const event =
    typeof root.event === 'string' && root.event.trim() ? root.event.trim() : 'unknown'
  const data = asRecord(root.data)
  const externalSaleId = parseSaleId(data?.id)
  const externalUpdatedAt = parseDate(data?.updatedAt)

  if (event === 'unknown') {
    return {
      event,
      externalSaleId,
      externalUpdatedAt,
      valid: false,
      error: 'El payload no incluye "event".',
    }
  }

  if (!externalSaleId) {
    return {
      event,
      externalSaleId: null,
      externalUpdatedAt,
      valid: false,
      error: 'El payload no incluye "data.id".',
    }
  }

  return {
    event,
    externalSaleId,
    externalUpdatedAt,
    valid: true,
    error: null,
  }
}
