import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { products } from './products'

export const CATEGORY_STATUSES = ['active', 'inactive'] as const
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number]

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
 * Categoría global del catálogo. Un producto puede pertenecer a varias
 * categorías mediante `product_categories`, por eso no hay category_id en
 * `products`.
 */
export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status', { enum: CATEGORY_STATUSES }).notNull().default('active'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('categories_name_uq').on(table.name),
    index('categories_status_idx').on(table.status),
    check('categories_name_not_empty', sql`length(trim(${table.name})) > 0`),
  ],
)

/** Tabla puente producto ↔ categoría (relación muchos a muchos). */
export const productCategories = sqliteTable(
  'product_categories',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'restrict' }),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    uniqueIndex('product_categories_product_category_uq').on(
      table.productId,
      table.categoryId,
    ),
    index('product_categories_product_idx').on(table.productId),
    index('product_categories_category_idx').on(table.categoryId),
  ],
)

export type CategoryRecord = typeof categories.$inferSelect
export type NewCategoryRecord = typeof categories.$inferInsert
export type ProductCategoryRecord = typeof productCategories.$inferSelect
export type NewProductCategoryRecord = typeof productCategories.$inferInsert
