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
import { products } from './products'

/**
 * Componentes de una promoción. Una promoción descuenta inventario de sus
 * componentes, no de sí misma. No se permiten promociones anidadas: la API
 * valida que `component_product_id` no sea otra promoción.
 */
export const productComponents = sqliteTable(
  'product_components',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    componentProductId: text('component_product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    quantity: integer('quantity').notNull().default(1),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('product_components_product_component_uq').on(
      table.productId,
      table.componentProductId,
    ),
    index('product_components_product_idx').on(table.productId),
    index('product_components_component_idx').on(table.componentProductId),
    check('product_components_quantity_positive', sql`${table.quantity} > 0`),
    check('product_components_not_self', sql`${table.productId} <> ${table.componentProductId}`),
  ],
)

export type ProductComponentRecord = typeof productComponents.$inferSelect
export type NewProductComponentRecord = typeof productComponents.$inferInsert
