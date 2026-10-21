import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { partners } from './partners'
import { user } from './auth.generated'

export const auditLogs = sqliteTable(
  'audit_logs',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    actorId: text('actor_id').references(() => user.id, { onDelete: 'set null' }),
    partnerId: text('partner_id').references(() => partners.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    description: text('description').notNull(),
    metadata: text('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('audit_logs_created_idx').on(table.createdAt),
    index('audit_logs_partner_idx').on(table.partnerId),
    index('audit_logs_actor_idx').on(table.actorId),
  ],
)

export type AuditLogRecord = typeof auditLogs.$inferSelect
export type NewAuditLogRecord = typeof auditLogs.$inferInsert
