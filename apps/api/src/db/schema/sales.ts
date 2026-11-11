import { sql } from 'drizzle-orm'
import {
  check,
  foreignKey,
  index,
  integer,
  numeric,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'
import { newId } from '../../lib/ids'
import { user } from './auth.generated'
import { partners } from './partners'
import { channels } from './channels'
import { PRODUCT_TYPES, products } from './products'

export const SALE_STATUSES = ['confirmed', 'cancelled'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PAYMENT_METHODS = [
  'cash',
  'transfer',
  'pago_movil',
  'zelle',
  'card',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_RECORD_STATUSES = ['confirmed', 'voided'] as const
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number]

export const DISCOUNT_TYPES = ['none', 'amount', 'percent'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]

const CURRENCY_ENUM = ['USD', 'EUR', 'VES'] as const
const money = (name: string) => numeric(name, { mode: 'number' })

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
 * Cabecera de venta. Guarda snapshots del aliado y de su canal para que el
 * documento histórico no cambie si luego se renombran. Los importes se
 * conservan en las tres monedas: la del canal (base), VES y la tercera.
 */
export const sales = sqliteTable(
  'sales',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    partnerId: text('partner_id')
      .notNull()
      .references(() => partners.id, { onDelete: 'restrict' }),
    partnerName: text('partner_name').notNull(),
    partnerRif: text('partner_rif'),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id, { onDelete: 'restrict' }),
    channelName: text('channel_name').notNull(),
    currency: text('currency', { enum: CURRENCY_ENUM }).notNull(),
    usdRate: numeric('usd_rate', { mode: 'number' }).notNull(),
    eurRate: numeric('eur_rate', { mode: 'number' }).notNull(),
    rateDate: text('rate_date').notNull(),
    rateSource: text('rate_source', { enum: ['bcv'] })
      .notNull()
      .default('bcv'),

    subtotalUsd: money('subtotal_usd').notNull(),
    discountUsd: money('discount_usd').notNull(),
    ivaUsd: money('iva_usd').notNull(),
    totalUsd: money('total_usd').notNull(),
    subtotalEur: money('subtotal_eur').notNull(),
    discountEur: money('discount_eur').notNull(),
    ivaEur: money('iva_eur').notNull(),
    totalEur: money('total_eur').notNull(),
    subtotalVes: money('subtotal_ves').notNull(),
    discountVes: money('discount_ves').notNull(),
    ivaVes: money('iva_ves').notNull(),
    totalVes: money('total_ves').notNull(),

    discountType: text('discount_type', { enum: DISCOUNT_TYPES }).notNull().default('none'),
    discountValue: money('discount_value').notNull().default(0),

    soldAt: integer('sold_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: SALE_STATUSES }).notNull().default('confirmed'),
    paymentStatus: text('payment_status', { enum: PAYMENT_STATUSES })
      .notNull()
      .default('unpaid'),
    notes: text('notes'),

    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdByName: text('created_by_name').notNull(),
    ...timestamps,

    cancelledAt: integer('cancelled_at', { mode: 'timestamp_ms' }),
    cancelledBy: text('cancelled_by').references(() => user.id, { onDelete: 'set null' }),
    cancelledByName: text('cancelled_by_name'),
    cancelReason: text('cancel_reason'),
  },
  (table) => [
    uniqueIndex('sales_id_partner_uq').on(table.id, table.partnerId),
    index('sales_partner_sold_idx').on(table.partnerId, table.soldAt),
    index('sales_partner_status_idx').on(table.partnerId, table.status),
    index('sales_price_list_idx').on(table.channelId),
    check(
      'sales_total_usd_identity',
      sql`round(${table.totalUsd}, 2) = round(${table.subtotalUsd} - ${table.discountUsd} + ${table.ivaUsd}, 2)`,
    ),
    check(
      'sales_total_eur_identity',
      sql`round(${table.totalEur}, 2) = round(${table.subtotalEur} - ${table.discountEur} + ${table.ivaEur}, 2)`,
    ),
    check(
      'sales_total_ves_identity',
      sql`round(${table.totalVes}, 2) = round(${table.subtotalVes} - ${table.discountVes} + ${table.ivaVes}, 2)`,
    ),
    check(
      'sales_discount_non_negative',
      sql`${table.discountUsd} >= 0 and ${table.discountEur} >= 0 and ${table.discountVes} >= 0`,
    ),
  ],
)

/**
 * Línea de venta. Guarda el snapshot del producto y los importes en la moneda
 * base del canal y en VES. El EUR solo se guarda en la cabecera.
 */
export const saleItems = sqliteTable(
  'sale_items',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    partnerId: text('partner_id').notNull(),
    saleId: text('sale_id').notNull(),
    productId: text('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'restrict' }),
    sku: text('sku').notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: PRODUCT_TYPES }).notNull(),
    quantity: integer('quantity').notNull(),
    unitPrice: money('unit_price').notNull(),
    subtotal: money('subtotal').notNull(),
    discount: money('discount').notNull().default(0),
    ivaEnabled: integer('iva_enabled', { mode: 'boolean' }).notNull(),
    ivaRate: numeric('iva_rate', { mode: 'number' }).notNull(),
    iva: money('iva').notNull(),
    total: money('total').notNull(),
    subtotalVes: money('subtotal_ves').notNull(),
    discountVes: money('discount_ves').notNull().default(0),
    ivaVes: money('iva_ves').notNull(),
    totalVes: money('total_ves').notNull(),
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.saleId, table.partnerId],
      foreignColumns: [sales.id, sales.partnerId],
      name: 'sale_items_sale_partner_fk',
    }).onDelete('cascade'),
    index('sale_items_sale_idx').on(table.saleId, table.position),
    index('sale_items_partner_product_idx').on(table.partnerId, table.productId),
    check('sale_items_quantity_positive', sql`${table.quantity} > 0`),
    check(
      'sale_items_total_identity',
      sql`round(${table.total}, 2) = round(${table.subtotal} - ${table.discount} + ${table.iva}, 2)`,
    ),
    check(
      'sale_items_total_ves_identity',
      sql`round(${table.totalVes}, 2) = round(${table.subtotalVes} - ${table.discountVes} + ${table.ivaVes}, 2)`,
    ),
  ],
)

/**
 * Pago anidado a la venta. Cada pago guarda su propia moneda y tasa porque un
 * pago posterior puede usar una tasa distinta a la de la venta.
 */
export const salePayments = sqliteTable(
  'sale_payments',
  {
    id: text('id').primaryKey().$defaultFn(newId),
    partnerId: text('partner_id').notNull(),
    saleId: text('sale_id').notNull(),
    currency: text('currency', { enum: CURRENCY_ENUM }).notNull(),
    amount: money('amount').notNull(),
    amountVes: money('amount_ves').notNull(),
    usdRate: numeric('usd_rate', { mode: 'number' }).notNull(),
    eurRate: numeric('eur_rate', { mode: 'number' }).notNull(),
    rateDate: text('rate_date').notNull(),
    method: text('method', { enum: PAYMENT_METHODS }).notNull(),
    reference: text('reference'),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }).notNull(),
    status: text('status', { enum: PAYMENT_RECORD_STATUSES }).notNull().default('confirmed'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => user.id, { onDelete: 'set null' }),
    createdByName: text('created_by_name').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
    voidedAt: integer('voided_at', { mode: 'timestamp_ms' }),
    voidedBy: text('voided_by').references(() => user.id, { onDelete: 'set null' }),
    voidedByName: text('voided_by_name'),
    voidReason: text('void_reason'),
  },
  (table) => [
    foreignKey({
      columns: [table.saleId, table.partnerId],
      foreignColumns: [sales.id, sales.partnerId],
      name: 'sale_payments_sale_partner_fk',
    }).onDelete('cascade'),
    index('sale_payments_sale_idx').on(table.saleId, table.paidAt),
    index('sale_payments_partner_idx').on(table.partnerId, table.paidAt),
    check('sale_payments_amount_positive', sql`${table.amount} > 0`),
    check('sale_payments_amount_ves_non_negative', sql`${table.amountVes} >= 0`),
  ],
)

export type SaleRecord = typeof sales.$inferSelect
export type NewSaleRecord = typeof sales.$inferInsert
export type SaleItemRecord = typeof saleItems.$inferSelect
export type NewSaleItemRecord = typeof saleItems.$inferInsert
export type SalePaymentRecord = typeof salePayments.$inferSelect
export type NewSalePaymentRecord = typeof salePayments.$inferInsert
