import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { channels } from './channels'
import { products } from './products'

export const PRODUCT_CHANNEL_STATUSES = ['active', 'inactive'] as const
export type ProductChannelStatus = (typeof PRODUCT_CHANNEL_STATUSES)[number]

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
    .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
}

/**
 * Disponibilidad de un producto en un canal de venta. Es independiente del
 * precio: un producto puede estar activo en un canal aunque todavía no tenga
 * precio configurado.
 *
 * La ausencia de fila significa que el producto está activo en ese canal. Solo
 * se guardan excepciones (normalmente desactivaciones) para no duplicar toda
 * la matriz producto × canal.
 */
export const productChannels = sqliteTable(
  'product_channels',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    status: text('status', { enum: PRODUCT_CHANNEL_STATUSES }).notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('product_channels_product_channel_uq').on(table.productId, table.channelId),
    index('product_channels_product_idx').on(table.productId),
    index('product_channels_channel_status_idx').on(table.channelId, table.status),
  ],
)

export type ProductChannelRecord = typeof productChannels.$inferSelect
export type NewProductChannelRecord = typeof productChannels.$inferInsert
