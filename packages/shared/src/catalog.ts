import { z } from 'zod'
import { currencySchema, paginationSchema, type Currency } from './common'

export const PRODUCT_TYPES = ['article', 'service', 'promotion'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]
export const productTypeSchema = z.enum(PRODUCT_TYPES)

export const PRODUCT_STATUSES = ['active', 'inactive'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export const productStatusSchema = z.enum(PRODUCT_STATUSES)

export const PRICE_LIST_STATUSES = ['active', 'inactive'] as const
export type PriceListStatus = (typeof PRICE_LIST_STATUSES)[number]
export const priceListStatusSchema = z.enum(PRICE_LIST_STATUSES)

export const PRICE_ITEM_STATUSES = ['active', 'inactive'] as const
export type PriceItemStatus = (typeof PRICE_ITEM_STATUSES)[number]
export const priceItemStatusSchema = z.enum(PRICE_ITEM_STATUSES)

/** Tasa fija de IVA general en Venezuela. */
export const IVA_RATE = 0.16

const optionalText = (max: number) => z.string().trim().max(max).optional().or(z.literal(''))

/**
 * Acepta "3458,28", "3458.28" o un número. La API siempre devuelve número.
 */
export const moneyInputSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    if (typeof value === 'number') return value

    const normalized = value.trim().replace(',', '.')
    const parsed = Number(normalized)

    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: 'custom', message: 'Usa un monto válido' })
      return z.NEVER
    }

    return parsed
  })
  .pipe(
    z
      .number()
      .min(0, 'El monto no puede ser negativo')
      .refine(
        (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-9,
        'Usa un monto con hasta 2 decimales',
      ),
  )

export const createProductSchema = z.object({
  sku: z.string().trim().min(1, 'El SKU es obligatorio').max(60),
  barcode: optionalText(60),
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(160),
  type: productTypeSchema.default('article'),
  ivaEnabled: z.boolean().default(false),
  status: productStatusSchema.default('active'),
  trackInventory: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

export const listProductsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: productStatusSchema.optional(),
  type: productTypeSchema.optional(),
  priceListId: z.string().trim().min(1).optional(),
})

export const createPriceListSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  currency: currencySchema,
  status: priceListStatusSchema.default('active'),
  description: optionalText(500),
})

export const updatePriceListSchema = createPriceListSchema.partial()

export const listPriceListsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: priceListStatusSchema.optional(),
  currency: currencySchema.optional(),
})

export const upsertPriceListItemSchema = z.object({
  productId: z.string().trim().min(1, 'Selecciona un producto'),
  price: moneyInputSchema,
  status: priceItemStatusSchema.default('active'),
  position: z.coerce.number().int().min(0).default(0),
})

export const syncPriceListItemsSchema = z.object({
  items: z.array(upsertPriceListItemSchema).max(2000),
})

export const updatePriceListItemSchema = z.object({
  price: moneyInputSchema.optional(),
  status: priceItemStatusSchema.optional(),
  position: z.coerce.number().int().min(0).optional(),
})

export const setProductComponentsSchema = z.object({
  components: z
    .array(
      z.object({
        componentProductId: z.string().trim().min(1, 'Selecciona un componente'),
        quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a 0').max(1000),
        position: z.coerce.number().int().min(0).default(0),
      }),
    )
    .max(50),
})

export type CreateProductInput = z.infer<typeof createProductSchema>
export type UpdateProductInput = z.infer<typeof updateProductSchema>
export type CreatePriceListInput = z.infer<typeof createPriceListSchema>
export type UpdatePriceListInput = z.infer<typeof updatePriceListSchema>
export type UpsertPriceListItemInput = z.infer<typeof upsertPriceListItemSchema>
export type SyncPriceListItemsInput = z.infer<typeof syncPriceListItemsSchema>
export type UpdatePriceListItemInput = z.infer<typeof updatePriceListItemSchema>
export type SetProductComponentsInput = z.infer<typeof setProductComponentsSchema>

export type Product = {
  id: string
  sku: string
  barcode: string | null
  name: string
  type: ProductType
  ivaEnabled: boolean
  status: ProductStatus
  trackInventory: boolean
  createdAt: string
  updatedAt: string
}

export type PriceList = {
  id: string
  name: string
  currency: Currency
  status: PriceListStatus
  description: string | null
  itemCount: number
  createdAt: string
  updatedAt: string
}

export type PriceListItem = {
  id: string
  priceListId: string
  productId: string
  productSku: string
  productName: string
  productType: ProductType
  productIvaEnabled: boolean
  price: number
  status: PriceItemStatus
  position: number
  createdAt: string
  updatedAt: string
}

/** Producto tal como lo ve el aliado: incluye el precio de su lista. */
export type CatalogProduct = Product & {
  priceItemId: string | null
  price: number | null
  priceStatus: PriceItemStatus | null
  position: number
}

export type PriceHistoryEntry = {
  id: string
  priceListId: string
  productId: string
  productSku: string
  productName: string
  oldPrice: number | null
  newPrice: number
  currency: Currency
  changedBy: string | null
  changedByName: string
  createdAt: string
}

export type ProductComponent = {
  id: string
  componentProductId: string
  componentSku: string
  componentName: string
  componentType: ProductType
  quantity: number
  position: number
}

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  article: 'Artículo',
  service: 'Servicio',
  promotion: 'Promoción',
}

export const PRICE_LIST_STATUS_LABELS: Record<PriceListStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
}

export const PRICE_ITEM_STATUS_LABELS: Record<PriceItemStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}
