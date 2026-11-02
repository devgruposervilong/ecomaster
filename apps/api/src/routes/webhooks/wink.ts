import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { winkWebhookEvents } from '../../db/schema'
import type { AppEnv } from '../../env'
import { AppError } from '../../lib/errors'
import { clientIp, userAgent } from '../../lib/http'
import { newId } from '../../lib/ids'
import { extractWinkEventMetadata } from '../../lib/wink/payload'
import { sha256Hex, verifyWinkSignature } from '../../lib/wink/signature'

export const winkWebhookRoutes = new Hono<AppEnv>()

/**
 * Recibe los webhooks de Wink.
 *
 * Fase 1: autentica con HMAC y guarda el payload crudo. No crea ventas ni
 * interpreta productos, pagos o estados. La unificación con `sales` se hará
 * en una fase posterior a partir de `wink_webhook_events`.
 */
winkWebhookRoutes.post('/wink', async (c) => {
  const secret = c.env.WINK_WEBHOOK_SECRET

  if (!secret) {
    throw new AppError(
      500,
      'WINK_WEBHOOK_NOT_CONFIGURED',
      'El webhook de Wink no está configurado en el servidor.',
    )
  }

  const rawBody = await c.req.text()
  const verification = await verifyWinkSignature({
    secret,
    timestamp: c.req.header('x-wink-timestamp'),
    signature: c.req.header('x-wink-signature'),
    rawBody,
  })

  if (!verification.ok) {
    throw new AppError(401, verification.code, verification.message)
  }

  let payload: unknown

  try {
    payload = JSON.parse(rawBody)
  } catch {
    throw new AppError(400, 'INVALID_JSON', 'El cuerpo del webhook no es JSON válido.')
  }

  const metadata = extractWinkEventMetadata(payload)
  const payloadHash = await sha256Hex(rawBody)
  const db = c.get('db')

  const [inserted] = await db
    .insert(winkWebhookEvents)
    .values({
      id: newId(),
      externalSaleId: metadata.externalSaleId,
      event: metadata.event,
      payloadHash,
      payload: rawBody,
      status: metadata.valid ? 'received' : 'invalid',
      error: metadata.error,
      externalUpdatedAt: metadata.externalUpdatedAt,
      signatureTimestamp: verification.timestamp,
      ipAddress: clientIp(c),
      userAgent: userAgent(c),
    })
    .onConflictDoNothing({ target: winkWebhookEvents.payloadHash })
    .returning({ id: winkWebhookEvents.id })

  if (!inserted) {
    const [existing] = await db
      .select({
        id: winkWebhookEvents.id,
        event: winkWebhookEvents.event,
        externalSaleId: winkWebhookEvents.externalSaleId,
        status: winkWebhookEvents.status,
      })
      .from(winkWebhookEvents)
      .where(eq(winkWebhookEvents.payloadHash, payloadHash))
      .limit(1)

    return c.json({
      ok: true,
      data: {
        id: existing?.id ?? null,
        event: existing?.event ?? metadata.event,
        externalSaleId: existing?.externalSaleId ?? metadata.externalSaleId,
        status: existing?.status ?? (metadata.valid ? 'received' : 'invalid'),
        duplicate: true,
      },
    })
  }

  return c.json({
    ok: true,
    data: {
      id: inserted.id,
      event: metadata.event,
      externalSaleId: metadata.externalSaleId,
      status: metadata.valid ? 'received' : 'invalid',
      duplicate: false,
    },
  })
})
