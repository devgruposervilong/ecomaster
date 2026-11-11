import { sql } from 'drizzle-orm'
import { foreignKey, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { channels } from './channels'

export const partners = sqliteTable(
  'partners',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    name: text('name').notNull(),
    alias: text('alias'),
    rif: text('rif'),
    slug: text('slug').notNull().unique(),
    type: text('type', { enum: ['permanente', 'bazar'] }).notNull(),
    currency: text('currency', { enum: ['USD', 'EUR', 'VES'] }).notNull(),
    channelId: text('channel_id').notNull(),
    status: text('status', { enum: ['active', 'inactive'] })
      .notNull()
      .default('active'),
    profitWarehouseCode: text('profit_warehouse_code'),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.channelId, table.currency],
      foreignColumns: [channels.id, channels.currency],
      name: 'partners_price_list_currency_fk',
    }).onDelete('restrict'),
    index('partners_status_idx').on(table.status),
    index('partners_price_list_idx').on(table.channelId),
  ],
)

export type PartnerRecord = typeof partners.$inferSelect
export type NewPartnerRecord = typeof partners.$inferInsert
