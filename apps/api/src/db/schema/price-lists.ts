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

export const PRICE_LIST_STATUSES = ['active', 'inactive'] as const
export type PriceListStatus = (typeof PRICE_LIST_STATUSES)[number]

export const PRICE_ITEM_STATUSES = ['active', 'inactive'] as const
export type PriceItemStatus = (typeof PRICE_ITEM_STATUSES)[number]

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
 * Lista de precios global. Varios aliados pueden compartir la misma lista,
 * pero todos deben tener la misma moneda que la lista.
 */
export const priceLists = sqliteTable(
  'price_lists',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    name: text('name').notNull(),
    currency: text('currency', { enum: CURRENCY_ENUM }).notNull(),
    status: text('status', { enum: PRICE_LIST_STATUSES }).notNull().default('active'),
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
 * Tabla puente producto ↔ lista. El precio decimal vive aquí, no en
 * `products`, y se guarda con punto decimal (por ejemplo 3458.28).
 */
export const priceListItems = sqliteTable(
  'price_list_items',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    priceListId: text('price_list_id')
      .notNull()
      .references(() => priceLists.id, { onDelete: 'cascade' }),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    price: numeric('price', { mode: 'number' }).notNull(),
    status: text('status', { enum: PRICE_ITEM_STATUSES }).notNull().default('active'),
    position: integer('position').notNull().default(0),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('price_list_items_list_product_uq').on(table.priceListId, table.productId),
    index('price_list_items_list_status_position_idx').on(
      table.priceListId,
      table.status,
      table.position,
    ),
    index('price_list_items_product_idx').on(table.productId),
    check('price_list_items_price_non_negative', sql`${table.price} >= 0`),
  ],
)

/**
 * Historial de precios por lista + producto. Se conserva aunque el ítem se
 * elimine de la lista.
 */
export const priceHistory = sqliteTable(
  'price_history',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    priceListId: text('price_list_id')
      .notNull()
      .references(() => priceLists.id, { onDelete: 'cascade' }),
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
      table.priceListId,
      table.productId,
      table.createdAt,
    ),
    index('price_history_product_created_idx').on(table.productId, table.createdAt),
  ],
)

export type PriceListRecord = typeof priceLists.$inferSelect
export type NewPriceListRecord = typeof priceLists.$inferInsert
export type PriceListItemRecord = typeof priceListItems.$inferSelect
export type NewPriceListItemRecord = typeof priceListItems.$inferInsert
export type PriceHistoryRecord = typeof priceHistory.$inferSelect
export type NewPriceHistoryRecord = typeof priceHistory.$inferInsert
