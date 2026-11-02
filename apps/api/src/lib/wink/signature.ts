/**
 * Verificación de la firma HMAC de los webhooks de Wink.
 *
 * Wink firma `"<timestamp>.<body-crudo>"` con HMAC-SHA256 y envía el resultado
 * en `X-Wink-Signature` con el formato `sha256=<hex>`. El timestamp viaja en
 * `X-Wink-Timestamp` (segundos Unix).
 */

export const WINK_SIGNATURE_TOLERANCE_SECONDS = 300

export type WinkSignatureFailureCode =
  | 'MISSING_SIGNATURE_HEADERS'
  | 'INVALID_TIMESTAMP'
  | 'STALE_TIMESTAMP'
  | 'INVALID_SIGNATURE'

export type WinkSignatureVerification =
  | { ok: true; timestamp: number }
  | { ok: false; code: WinkSignatureFailureCode; message: string }

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return toHex(digest)
}

export async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message))
  return toHex(signature)
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

export type WinkSignatureInput = {
  secret: string
  timestamp: string | undefined
  signature: string | undefined
  rawBody: string
  now?: number
}

export async function verifyWinkSignature(
  input: WinkSignatureInput,
): Promise<WinkSignatureVerification> {
  const { secret, timestamp, signature, rawBody } = input

  if (!timestamp || !signature) {
    return {
      ok: false,
      code: 'MISSING_SIGNATURE_HEADERS',
      message: 'Faltan los headers de firma del webhook.',
    }
  }

  if (!/^\d+$/.test(timestamp)) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'El timestamp del webhook no es válido.',
    }
  }

  const timestampSeconds = Number(timestamp)

  if (!Number.isSafeInteger(timestampSeconds) || timestampSeconds <= 0) {
    return {
      ok: false,
      code: 'INVALID_TIMESTAMP',
      message: 'El timestamp del webhook no es válido.',
    }
  }

  const now = input.now ?? Math.floor(Date.now() / 1000)

  if (Math.abs(now - timestampSeconds) > WINK_SIGNATURE_TOLERANCE_SECONDS) {
    return {
      ok: false,
      code: 'STALE_TIMESTAMP',
      message: 'El webhook llegó fuera de la ventana de tiempo permitida.',
    }
  }

  const normalized = signature.trim().toLowerCase()
  const receivedHex = normalized.startsWith('sha256=') ? normalized.slice('sha256='.length) : ''

  if (!/^[0-9a-f]{64}$/.test(receivedHex)) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'La firma del webhook no es válida.',
    }
  }

  const expectedHex = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`)

  if (!timingSafeEqual(receivedHex, expectedHex)) {
    return {
      ok: false,
      code: 'INVALID_SIGNATURE',
      message: 'La firma del webhook no es válida.',
    }
  }

  return { ok: true, timestamp: timestampSeconds }
}
