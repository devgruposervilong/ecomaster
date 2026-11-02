import { sql } from 'drizzle-orm'
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'

/**
 * Tasas de cambio publicadas por el BCV.
 *
 * `raw_usd` y `raw_eur` guardan el texto tal cual lo publica el BCV (con coma
 * decimal y todos sus decimales). Las columnas numéricas existen para poder
 * calcular y ordenar sin perder la representación original.
 */
export const exchangeRates = sqliteTable(
  'exchange_rate',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    date: text('date').notNull(),
    usdRate: real('usd_rate').notNull(),
    eurRate: real('eur_rate').notNull(),
    source: text('source', { enum: ['bcv'] })
      .notNull()
      .default('bcv'),
    rawUsd: text('raw_usd').notNull(),
    rawEur: text('raw_eur').notNull(),
    scrapedAt: integer('scraped_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex('exchange_rate_source_date_unique').on(table.source, table.date),
    index('exchange_rate_date_idx').on(table.date),
  ],
)

export type ExchangeRateRecord = typeof exchangeRates.$inferSelect
export type NewExchangeRateRecord = typeof exchangeRates.$inferInsert
