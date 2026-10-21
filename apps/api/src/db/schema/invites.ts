import { sql } from 'drizzle-orm'
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { partners } from './partners'
import { user } from './auth.generated'

export const invites = sqliteTable(
  'invites',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    tokenHash: text('token_hash').notNull().unique(),
    email: text('email').notNull(),
    partnerId: text('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'cascade' }),
    role: text('role', { enum: ['admin', 'partner_admin', 'partner_operator'] }).notNull(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    usedAt: integer('used_at', { mode: 'timestamp_ms' }),
    revokedAt: integer('revoked_at', { mode: 'timestamp_ms' }),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    index('invites_email_idx').on(table.email),
    index('invites_partner_idx').on(table.partnerId),
    index('invites_expires_idx').on(table.expiresAt),
  ],
)

export type InviteRecord = typeof invites.$inferSelect
export type NewInviteRecord = typeof invites.$inferInsert
