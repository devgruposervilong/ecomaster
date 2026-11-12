import { z } from 'zod'
import { currencySchema, paginationSchema, type Currency } from './common'

export const PRODUCT_TYPES = ['article', 'service', 'promotion'] as const
export type ProductType = (typeof PRODUCT_TYPES)[number]
export const productTypeSchema = z.enum(PRODUCT_TYPES)

export const PRODUCT_STATUSES = ['active', 'inactive'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export const productStatusSchema = z.enum(PRODUCT_STATUSES)

export const CATEGORY_STATUSES = ['active', 'inactive'] as const
export type CategoryStatus = (typeof CATEGORY_STATUSES)[number]
export const categoryStatusSchema = z.enum(CATEGORY_STATUSES)

export const CHANNEL_STATUSES = ['active', 'inactive'] as const
export type ChannelStatus = (typeof CHANNEL_STATUSES)[number]
export const channelStatusSchema = z.enum(CHANNEL_STATUSES)

export const CHANNEL_PRICE_STATUSES = ['active', 'inactive'] as const
export type ChannelPriceStatus = (typeof CHANNEL_PRICE_STATUSES)[number]
export const channelPriceStatusSchema = z.enum(CHANNEL_PRICE_STATUSES)

export const PRODUCT_CHANNEL_STATUSES = ['active', 'inactive'] as const
export type ProductChannelStatus = (typeof PRODUCT_CHANNEL_STATUSES)[number]
export const productChannelStatusSchema = z.enum(PRODUCT_CHANNEL_STATUSES)

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
  categoryIds: z
    .array(z.string().trim().min(1, 'Selecciona una categoría'))
    .max(20, 'Un producto no puede tener más de 20 categorías')
    .default([]),
})

export const updateProductSchema = createProductSchema.partial()

export const listProductsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: productStatusSchema.optional(),
  type: productTypeSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
  channelId: z.string().trim().min(1).optional(),
})

export const createCategorySchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  description: optionalText(300),
  status: categoryStatusSchema.default('active'),
})

export const updateCategorySchema = createCategorySchema.partial()

export const listCategoriesQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: categoryStatusSchema.optional(),
})

export const createChannelSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(80),
  currency: currencySchema,
  status: channelStatusSchema.default('active'),
  description: optionalText(500),
})

export const updateChannelSchema = createChannelSchema.partial()

export const listChannelsQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: channelStatusSchema.optional(),
  currency: currencySchema.optional(),
})

export const upsertChannelPriceSchema = z.object({
  productId: z.string().trim().min(1, 'Selecciona un producto'),
  price: moneyInputSchema,
  status: channelPriceStatusSchema.default('active'),
  position: z.coerce.number().int().min(0).default(0),
})

export const syncChannelPricesSchema = z.object({
  items: z.array(upsertChannelPriceSchema).max(2000),
})

export const updateChannelPriceSchema = z.object({
  price: moneyInputSchema.optional(),
  status: channelPriceStatusSchema.optional(),
  position: z.coerce.number().int().min(0).optional(),
})

/** Precio manual de un producto en un canal: crea el ítem si no existe. */
export const setChannelPriceSchema = z.object({
  price: moneyInputSchema,
  status: channelPriceStatusSchema.default('active'),
})

/** Activa o desactiva un producto dentro de un canal de venta. */
export const setProductChannelStatusSchema = z.object({
  status: productChannelStatusSchema,
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
export type CreateCategoryInput = z.infer<typeof createCategorySchema>
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>
export type CreateChannelInput = z.infer<typeof createChannelSchema>
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>
export type UpsertChannelPriceInput = z.infer<typeof upsertChannelPriceSchema>
export type SyncChannelPricesInput = z.infer<typeof syncChannelPricesSchema>
export type UpdateChannelPriceInput = z.infer<typeof updateChannelPriceSchema>
export type SetChannelPriceInput = z.infer<typeof setChannelPriceSchema>
export type SetProductChannelStatusInput = z.infer<typeof setProductChannelStatusSchema>
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
  categories: ProductCategory[]
  createdAt: string
  updatedAt: string
}

/** Referencia de categoría incluida en un producto. */
export type ProductCategory = {
  id: string
  name: string
  status: CategoryStatus
}

/** Categoría global con su conteo de productos. */
export type Category = {
  id: string
  name: string
  description: string | null
  status: CategoryStatus
  productCount: number
  createdAt: string
  updatedAt: string
}

/** Canal de precios. Antes se llamaba «lista de precios». */
export type Channel = {
  id: string
  name: string
  currency: Currency
  status: ChannelStatus
  description: string | null
  itemCount: number
  createdAt: string
  updatedAt: string
}

export type ChannelPrice = {
  id: string
  channelId: string
  productId: string
  productSku: string
  productName: string
  productType: ProductType
  productIvaEnabled: boolean
  price: number
  status: ChannelPriceStatus
  position: number
  createdAt: string
  updatedAt: string
}

/** Precio de un producto dentro de un canal (matriz de precios). */
export type ProductChannelPrice = {
  channelId: string
  channelName: string
  channelCurrency: Currency
  itemId: string | null
  price: number | null
  status: ChannelPriceStatus | null
  /** Disponibilidad del producto en el canal; ausencia de fila = activo. */
  available: ProductChannelStatus
}

/** Producto con sus precios por canal. */
export type CatalogProduct = Product & {
  priceItemId: string | null
  price: number | null
  priceStatus: ChannelPriceStatus | null
  available: ProductChannelStatus | null
  position: number
  prices: ProductChannelPrice[]
}

export type PriceHistoryEntry = {
  id: string
  channelId: string
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

export const CATEGORY_STATUS_LABELS: Record<CategoryStatus, string> = {
  active: 'Activa',
  inactive: 'Inactiva',
}

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}

export const CHANNEL_PRICE_STATUS_LABELS: Record<ChannelPriceStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}

export const PRODUCT_CHANNEL_STATUS_LABELS: Record<ProductChannelStatus, string> = {
  active: 'Activo',
  inactive: 'Inactivo',
}
