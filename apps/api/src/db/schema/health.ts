import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const healthchecks = sqliteTable('healthcheck', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  checkedAt: text('checked_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export type Healthcheck = typeof healthchecks.$inferSelect
export type NewHealthcheck = typeof healthchecks.$inferInsert
