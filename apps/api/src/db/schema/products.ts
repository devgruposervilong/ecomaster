import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'

export const PRODUCT_TYPES = ['article', 'service', 'promotion'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]

export const PRODUCT_STATUSES = ['active', 'inactive'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]

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
 * Catálogo global y plano. Cada fila es un artículo vendible: no existe
 * jerarquía padre/variante. El SKU es el código de Profit y es único global.
 *
 * El precio no vive aquí: vive en `price_list_items`, porque el mismo producto
 * puede tener precios distintos según la lista del aliado.
 */
export const products = sqliteTable(
  'products',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    sku: text('sku').notNull(),
    barcode: text('barcode'),
    name: text('name').notNull(),
    type: text('type', { enum: PRODUCT_TYPES }).notNull().default('article'),
    ivaEnabled: integer('iva_enabled', { mode: 'boolean' }).notNull().default(false),
    status: text('status', { enum: PRODUCT_STATUSES }).notNull().default('active'),
    trackInventory: integer('track_inventory', { mode: 'boolean' }).notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('products_sku_uq').on(table.sku),
    uniqueIndex('products_barcode_uq').on(table.barcode),
    index('products_status_idx').on(table.status),
    index('products_type_idx').on(table.type),
    index('products_name_idx').on(table.name),
    check('products_sku_not_empty', sql`length(trim(${table.sku})) > 0`),
  ],
)

export type ProductRecord = typeof products.$inferSelect
export type NewProductRecord = typeof products.$inferInsert
