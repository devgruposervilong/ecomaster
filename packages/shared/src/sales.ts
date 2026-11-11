import { z } from 'zod'
import { currencySchema, paginationSchema, type Currency } from './common'
import { moneyInputSchema } from './catalog'

export const SALE_STATUSES = ['confirmed', 'cancelled'] as const
export type SaleStatus = (typeof SALE_STATUSES)[number]
export const saleStatusSchema = z.enum(SALE_STATUSES)

export const PAYMENT_STATUSES = ['unpaid', 'partial', 'paid'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]
export const paymentStatusSchema = z.enum(PAYMENT_STATUSES)

export const PAYMENT_METHODS = [
  'cash',
  'transfer',
  'pago_movil',
  'zelle',
  'card',
  'other',
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)

export const PAYMENT_RECORD_STATUSES = ['confirmed', 'voided'] as const
export type PaymentRecordStatus = (typeof PAYMENT_RECORD_STATUSES)[number]

export const DISCOUNT_TYPES = ['none', 'amount', 'percent'] as const
export type DiscountType = (typeof DISCOUNT_TYPES)[number]
export const discountTypeSchema = z.enum(DISCOUNT_TYPES)

export const createSaleItemSchema = z.object({
  productId: z.string().trim().min(1, 'Selecciona un producto'),
  quantity: z.coerce.number().int('Usa una cantidad entera').positive('La cantidad debe ser mayor a 0'),
  /**
   * Solo un administrador puede enviarlo. Se usa cuando el producto no tiene
   * precio activo en el canal del aliado («se cobra a mano»).
   */
  unitPrice: moneyInputSchema.optional(),
})

export const createSalePaymentSchema = z.object({
  currency: currencySchema,
  method: paymentMethodSchema,
  reference: z.string().trim().max(120).optional().or(z.literal('')),
  /** Si se envía, el servidor verifica que coincida con el total. */
  amount: moneyInputSchema.optional(),
  paidAt: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export const createSaleSchema = z.object({
  /** Obligatorio para admin; para un aliado se toma de la sesión. */
  partnerId: z.string().trim().min(1).optional(),
  items: z.array(createSaleItemSchema).min(1, 'Agrega al menos un producto').max(200),
  discountType: discountTypeSchema.default('none'),
  discountValue: moneyInputSchema.default(0),
  payment: createSalePaymentSchema,
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  soldAt: z.coerce.date().optional(),
})

export const cancelSaleSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal('')),
})

export const listSalesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  partnerId: z.string().trim().min(1).optional(),
  status: saleStatusSchema.optional(),
  paymentStatus: paymentStatusSchema.optional(),
  from: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional(),
  to: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD').optional(),
})

export type CreateSaleInput = z.infer<typeof createSaleSchema>
export type CreateSaleItemInput = z.infer<typeof createSaleItemSchema>
export type CreateSalePaymentInput = z.infer<typeof createSalePaymentSchema>
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>

export type CurrencyAmounts = {
  subtotal: number
  discount: number
  iva: number
  total: number
}

/**
 * Importes por moneda. Siempre incluye la moneda base y VES. El EUR (o la
 * tercera moneda) solo se incluye si el usuario puede verlo.
 */
export type SaleAmounts = Partial<Record<Currency, CurrencyAmounts>>

export type Sale = {
  id: string
  partnerId: string
  partnerName: string
  partnerRif: string | null
  channelId: string
  channelName: string
  currency: Currency
  usdRate: number
  eurRate: number | null
  rateDate: string
  rateSource: 'bcv'
  amounts: SaleAmounts
  discountType: DiscountType
  discountValue: number
  soldAt: string
  status: SaleStatus
  paymentStatus: PaymentStatus
  notes: string | null
  createdBy: string | null
  createdByName: string
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  cancelledBy: string | null
  cancelledByName: string | null
  cancelReason: string | null
}

export type SaleItem = {
  id: string
  productId: string
  sku: string
  name: string
  type: 'article' | 'service' | 'promotion'
  quantity: number
  unitPrice: number
  subtotal: number
  discount: number
  ivaEnabled: boolean
  ivaRate: number
  iva: number
  total: number
  subtotalVes: number
  discountVes: number
  ivaVes: number
  totalVes: number
  position: number
}

export type SalePayment = {
  id: string
  currency: Currency
  amount: number
  amountVes: number
  usdRate: number
  eurRate: number | null
  rateDate: string
  method: PaymentMethod
  reference: string | null
  paidAt: string
  status: PaymentRecordStatus
  notes: string | null
  createdBy: string | null
  createdByName: string
  createdAt: string
  voidedAt: string | null
  voidedBy: string | null
  voidedByName: string | null
  voidReason: string | null
}

export type SaleDetail = Sale & {
  items: SaleItem[]
  payments: SalePayment[]
}

export const SALE_STATUS_LABELS: Record<SaleStatus, string> = {
  confirmed: 'Confirmada',
  cancelled: 'Anulada',
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Sin pagar',
  partial: 'Abonada',
  paid: 'Pagada',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  pago_movil: 'Pago Móvil',
  zelle: 'Zelle',
  card: 'Tarjeta',
  other: 'Otro',
}

export const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  none: 'Sin descuento',
  amount: 'Monto',
  percent: 'Porcentaje',
}

export const PAYMENT_RECORD_STATUS_LABELS: Record<PaymentRecordStatus, string> = {
  confirmed: 'Confirmado',
  voided: 'Anulado',
}
