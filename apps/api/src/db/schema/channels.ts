import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { user } from './auth.generated'
import { products } from './products'

export const CHANNEL_STATUSES = ['active', 'inactive'] as const
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number]

export const CHANNEL_PRICE_STATUSES = ['active', 'inactive'] as const
export type ChannelPriceStatus = (typeof CHANNEL_PRICE_STATUSES)[number]

const CURRENCY_ENUM = ['USD', 'EUR', 'VES'] as const

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
 * Canal de precios global. Varios aliados pueden compartir el mismo canal,
 * pero todos deben tener la misma moneda que el canal.
 */
export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    name: text('name').notNull(),
    currency: text('currency', { enum: CURRENCY_ENUM }).notNull(),
    status: text('status', { enum: CHANNEL_STATUSES }).notNull().default('active'),
    description: text('description'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('price_lists_name_uq').on(table.name),
    uniqueIndex('price_lists_id_currency_uq').on(table.id, table.currency),
    index('price_lists_currency_status_idx').on(table.currency, table.status),
  ],
)

/**
 * Tabla puente producto ↔ canal. El precio decimal vive aquí, no en
 * `products`, y se guarda con punto decimal (por ejemplo 3458.28).
 */
export const channelPrices = sqliteTable(
  'channel_prices',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    price: numeric('price', { mode: 'number' }).notNull(),
    status: text('status', { enum: CHANNEL_PRICE_STATUSES }).notNull().default('active'),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('price_list_items_list_product_uq').on(table.channelId, table.productId),
    index('price_list_items_list_status_position_idx').on(
      table.channelId,
      table.status,
      table.position,
    ),
    index('price_list_items_product_idx').on(table.productId),
    check('price_list_items_price_non_negative', sql`${table.price} >= 0`),
  ],
)

/**
 * Historial de precios por canal + producto. Se conserva aunque el ítem se
 * elimine del canal.
 */
export const priceHistory = sqliteTable(
  'price_history',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    oldPrice: numeric('old_price', { mode: 'number' }),
    newPrice: numeric('new_price', { mode: 'number' }).notNull(),
    currency: text('currency', { enum: CURRENCY_ENUM }).notNull(),
    changedBy: text('changed_by').references(() => user.id, { onDelete: 'set null' }),
    changedByName: text('changed_by_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('price_history_list_product_created_idx').on(
      table.channelId,
      table.productId,
      table.createdAt,
    ),
    index('price_history_product_created_idx').on(table.productId, table.createdAt),
  ],
)

export type ChannelRecord = typeof channels.$inferSelect
export type NewChannelRecord = typeof channels.$inferInsert
export type ChannelPriceRecord = typeof channelPrices.$inferSelect
export type NewChannelPriceRecord = typeof channelPrices.$inferInsert
export type PriceHistoryRecord = typeof priceHistory.$inferSelect
export type NewPriceHistoryRecord = typeof priceHistory.$inferInsert
