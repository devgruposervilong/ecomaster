import { describe, expect, it } from 'vitest'
import {
  hmacSha256Hex,
  verifyWinkSignature,
  WINK_SIGNATURE_TOLERANCE_SECONDS,
} from './signature'

const SECRET = 'wink-test-secret'
const RAW_BODY = '{"event":"new_sale","data":{"id":286}}'
const NOW = 1_800_000_000

async function sign(timestamp: number, body = RAW_BODY, secret = SECRET) {
  return `sha256=${await hmacSha256Hex(secret, `${timestamp}.${body}`)}`
}

describe('hmacSha256Hex', () => {
  it('coincide con un vector conocido', async () => {
    await expect(
      hmacSha256Hex('key', 'The quick brown fox jumps over the lazy dog'),
    ).resolves.toBe('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8')
  })
})

describe('verifyWinkSignature', () => {
  it('acepta una firma válida', async () => {
    const timestamp = String(NOW)
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp,
      signature: await sign(NOW),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toEqual({ ok: true, timestamp: NOW })
  })

  it('acepta el prefijo sha256 en mayúsculas', async () => {
    const timestamp = String(NOW)
    const signature = (await sign(NOW)).toUpperCase()
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp,
      signature,
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result.ok).toBe(true)
  })

  it('acepta el límite exacto de la ventana de tiempo', async () => {
    const timestamp = NOW - WINK_SIGNATURE_TOLERANCE_SECONDS
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(timestamp),
      signature: await sign(timestamp),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result.ok).toBe(true)
  })

  it('rechaza una firma inválida', async () => {
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(NOW),
      signature: await sign(NOW, RAW_BODY, 'otro-secreto'),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' })
  })

  it('rechaza un body alterado después de firmar', async () => {
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(NOW),
      signature: await sign(NOW),
      rawBody: `${RAW_BODY} `,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' })
  })

  it('rechaza un timestamp vencido', async () => {
    const timestamp = NOW - WINK_SIGNATURE_TOLERANCE_SECONDS - 1
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(timestamp),
      signature: await sign(timestamp),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'STALE_TIMESTAMP' })
  })

  it('rechaza un timestamp futuro fuera de la ventana', async () => {
    const timestamp = NOW + WINK_SIGNATURE_TOLERANCE_SECONDS + 1
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(timestamp),
      signature: await sign(timestamp),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'STALE_TIMESTAMP' })
  })

  it('rechaza headers faltantes', async () => {
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: undefined,
      signature: undefined,
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'MISSING_SIGNATURE_HEADERS' })
  })

  it('rechaza un timestamp que no es numérico', async () => {
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: 'ayer',
      signature: await sign(NOW),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_TIMESTAMP' })
  })

  it('rechaza una firma sin el prefijo sha256', async () => {
    const result = await verifyWinkSignature({
      secret: SECRET,
      timestamp: String(NOW),
      signature: (await sign(NOW)).replace('sha256=', ''),
      rawBody: RAW_BODY,
      now: NOW,
    })

    expect(result).toMatchObject({ ok: false, code: 'INVALID_SIGNATURE' })
  })
})
