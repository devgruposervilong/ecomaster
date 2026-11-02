import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'

export const WINK_EVENT_STATUSES = [
  'received',
  'invalid',
  'processed',
  'failed',
  'ignored',
] as const
export type WinkEventStatus = (typeof WINK_EVENT_STATUSES)[number]

/**
 * Bitácora cruda de los webhooks de Wink.
 *
 * El payload se guarda tal cual llegó y nunca se modifica. La unificación con
 * `sales` (Fase 2) solo actualiza los campos de procesamiento: `status`,
 * `error`, `sale_id`, `processing_attempts` y `processed_at`.
 *
 * Es una tabla global: los aliados no tienen acceso. Solo el scope `system`
 * escribe y el `admin` puede leerla.
 */
export const winkWebhookEvents = sqliteTable(
  'wink_webhook_events',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    externalSaleId: text('external_sale_id'),
    event: text('event').notNull().default('unknown'),
    payloadHash: text('payload_hash').notNull(),
    payload: text('payload').notNull(),
    status: text('status', { enum: WINK_EVENT_STATUSES }).notNull().default('received'),
    error: text('error'),
    saleId: text('sale_id'),
    externalUpdatedAt: integer('external_updated_at', { mode: 'timestamp_ms' }),
    signatureTimestamp: integer('signature_timestamp'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    processingAttempts: integer('processing_attempts').notNull().default(0),
    receivedAt: integer('received_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    processedAt: integer('processed_at', { mode: 'timestamp_ms' }),
  },
  (table) => [
    uniqueIndex('wink_webhook_events_payload_hash_uq').on(table.payloadHash),
    index('wink_webhook_events_sale_idx').on(table.externalSaleId, table.externalUpdatedAt),
    index('wink_webhook_events_received_idx').on(table.receivedAt),
    index('wink_webhook_events_status_idx').on(table.status),
  ],
)

export type WinkWebhookEventRecord = typeof winkWebhookEvents.$inferSelect
export type NewWinkWebhookEventRecord = typeof winkWebhookEvents.$inferInsert
