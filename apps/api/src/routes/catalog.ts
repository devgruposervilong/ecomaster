import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  like,
  or,
  sql,
  type SQL,
} from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import {
  createChannelSchema,
  createProductSchema,
  isGlobalRole,
  listChannelsQuerySchema,
  listProductsQuerySchema,
  setChannelPriceSchema,
  setProductComponentsSchema,
  syncChannelPricesSchema,
  updateChannelSchema,
  updateProductSchema,
  type CatalogProduct,
  type Channel,
  type ChannelPrice,
  type ChannelPriceStatus,
  type PriceHistoryEntry,
  type Product,
  type ProductChannelPrice,
  type ProductComponent,
  type ProductType,
} from '@ecomaster/shared'
import {
  channels,
  channelPrices,
  partners,
  priceHistory,
  productComponents,
  products,
  saleItems,
  sales,
} from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { newId } from '../lib/ids'
import { jsonBody, queryParams } from '../lib/validation'

export const catalogRoutes = new Hono<AppEnv>()

type Db = AppEnv['Variables']['db']
type Session = NonNullable<AppEnv['Variables']['session']>

const productSelection = {
  id: products.id,
  sku: products.sku,
  barcode: products.barcode,
  name: products.name,
  type: products.type,
  ivaEnabled: products.ivaEnabled,
  status: products.status,
  trackInventory: products.trackInventory,
  createdAt: products.createdAt,
  updatedAt: products.updatedAt,
}

type ProductRow = {
  id: string
  sku: string
  barcode: string | null
  name: string
  type: ProductType
  ivaEnabled: boolean
  status: Product['status']
  trackInventory: boolean
  createdAt: Date
  updatedAt: Date
}

type ChannelRow = Pick<Channel, 'id' | 'name' | 'currency' | 'status'>

function nullable(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function requireAdminSession(c: Context<AppEnv>): Session {
  const session = c.get('session')

  if (!session || session.user.role !== 'admin') {
    throw forbidden('Solo un administrador puede administrar el catálogo.')
  }

  return session
}

function serializeProduct(row: ProductRow): Product {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function findPartnerChannelId(db: Db, partnerId: string | null) {
  if (!partnerId) return null

  const [row] = await db
    .select({ channelId: partners.channelId })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1)

  return row?.channelId ?? null
}

async function resolveChannelId(c: Context<AppEnv>, requested?: string) {
  const session = c.get('session')

  if (!session) return requested ?? null
  if (isGlobalRole(session.user.role)) return requested ?? null

  return findPartnerChannelId(c.get('db'), session.user.partnerId ?? null)
}

async function assertChannelAccess(c: Context<AppEnv>, channelId: string) {
  const session = c.get('session')

  if (!session) throw forbidden('Debes iniciar sesión.')

  if (isGlobalRole(session.user.role)) {
    const [channel] = await c
      .get('db')
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.id, channelId))
      .limit(1)

    if (!channel) throw notFound('No encontramos este canal de precios.')
    return
  }

  const partnerChannelId = await findPartnerChannelId(
    c.get('db'),
    session.user.partnerId ?? null,
  )

  if (partnerChannelId !== channelId) {
    throw forbidden('No tienes acceso a este canal de precios.')
  }
}

async function findProduct(db: Db, id: string) {
  const [row] = await db.select(productSelection).from(products).where(eq(products.id, id)).limit(1)
  return row ? serializeProduct(row) : null
}

async function assertPartnerProductAccess(c: Context<AppEnv>, product: Product) {
  const session = c.get('session')

  if (!session) throw forbidden('Debes iniciar sesión.')
  if (isGlobalRole(session.user.role)) return

  const channelId = await findPartnerChannelId(c.get('db'), session.user.partnerId ?? null)

  if (!channelId || product.status !== 'active') {
    throw notFound('No encontramos este producto en tu canal de precios.')
  }

  const [item] = await c
    .get('db')
    .select({ status: channelPrices.status })
    .from(channelPrices)
    .where(
      and(eq(channelPrices.channelId, channelId), eq(channelPrices.productId, product.id)),
    )
    .limit(1)

  if (!item || item.status !== 'active') {
    throw notFound('No encontramos este producto en tu canal de precios.')
  }
}

async function findChannel(db: Db, id: string) {
  const [row] = await db
    .select({
      id: channels.id,
      name: channels.name,
      currency: channels.currency,
      status: channels.status,
      description: channels.description,
      itemCount: count(channelPrices.id),
      createdAt: channels.createdAt,
      updatedAt: channels.updatedAt,
    })
    .from(channels)
    .leftJoin(channelPrices, eq(channelPrices.channelId, channels.id))
    .where(eq(channels.id, id))
    .groupBy(channels.id)
    .limit(1)

  return row ? serializeChannel(row) : null
}

function serializeChannel(row: {
  id: string
  name: string
  currency: Channel['currency']
  status: Channel['status']
  description: string | null
  itemCount: number
  createdAt: Date
  updatedAt: Date
}): Channel {
  return {
    ...row,
    itemCount: Number(row.itemCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeChannelPrice(row: {
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
  createdAt: Date
  updatedAt: Date
}): ChannelPrice {
  return {
    ...row,
    price: Number(row.price),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeHistory(row: {
  id: string
  channelId: string
  productId: string
  productSku: string
  productName: string
  oldPrice: number | null
  newPrice: number
  currency: PriceHistoryEntry['currency']
  changedBy: string | null
  changedByName: string
  createdAt: Date
}): PriceHistoryEntry {
  return {
    ...row,
    oldPrice: row.oldPrice === null ? null : Number(row.oldPrice),
    newPrice: Number(row.newPrice),
    createdAt: row.createdAt.toISOString(),
  }
}

async function assertUniqueProduct(
  db: Db,
  input: { sku: string; barcode: string | null; excludeId?: string },
) {
  const conditions: SQL[] = [eq(products.sku, input.sku)]
  if (input.barcode) conditions.push(eq(products.barcode, input.barcode))

  const rows = await db
    .select({ id: products.id, sku: products.sku, barcode: products.barcode })
    .from(products)
    .where(or(...conditions))

  for (const row of rows) {
    if (row.id === input.excludeId) continue
    if (row.sku === input.sku) {
      throw conflict(`Ya existe un producto con el SKU ${input.sku}.`)
    }
    if (input.barcode && row.barcode === input.barcode) {
      throw conflict(`Ya existe un producto con el código de barras ${input.barcode}.`)
    }
  }
}

async function assertProductUnused(db: Db, productId: string) {
  const [priceItems] = await db
    .select({ total: count() })
    .from(channelPrices)
    .where(eq(channelPrices.productId, productId))
  const [sold] = await db
    .select({ total: count() })
    .from(saleItems)
    .where(eq(saleItems.productId, productId))
  const [componentOf] = await db
    .select({ total: count() })
    .from(productComponents)
    .where(eq(productComponents.componentProductId, productId))
  const [history] = await db
    .select({ total: count() })
    .from(priceHistory)
    .where(eq(priceHistory.productId, productId))

  if (
    Number(priceItems?.total ?? 0) > 0 ||
    Number(sold?.total ?? 0) > 0 ||
    Number(componentOf?.total ?? 0) > 0 ||
    Number(history?.total ?? 0) > 0
  ) {
    throw conflict(
      'El producto tiene precios, ventas o componentes asociados. Desactívalo en lugar de eliminarlo.',
    )
  }
}

async function listMatrixChannels(db: Db, isPartner: boolean, partnerChannelId: string | null) {
  if (isPartner) {
    if (!partnerChannelId) return [] as ChannelRow[]

    return db
      .select({
        id: channels.id,
        name: channels.name,
        currency: channels.currency,
        status: channels.status,
      })
      .from(channels)
      .where(eq(channels.id, partnerChannelId))
  }

  return db
    .select({
      id: channels.id,
      name: channels.name,
      currency: channels.currency,
      status: channels.status,
    })
    .from(channels)
    .where(eq(channels.status, 'active'))
    .orderBy(
      sql`case when lower(${channels.name}) like 'principal%' then 0 else 1 end`,
      asc(channels.name),
    )
}

async function buildProductPrices(
  db: Db,
  productIds: string[],
  channelRows: ChannelRow[],
) {
  const byProduct = new Map<string, ProductChannelPrice[]>()

  if (productIds.length === 0 || channelRows.length === 0) {
    return byProduct
  }

  const rows = await db
    .select({
      id: channelPrices.id,
      channelId: channelPrices.channelId,
      productId: channelPrices.productId,
      price: channelPrices.price,
      status: channelPrices.status,
      position: channelPrices.position,
    })
    .from(channelPrices)
    .where(
      and(
        inArray(channelPrices.productId, productIds),
        inArray(
          channelPrices.channelId,
          channelRows.map((channel) => channel.id),
        ),
      ),
    )

  const byKey = new Map(rows.map((row) => [`${row.productId}:${row.channelId}`, row]))

  for (const productId of productIds) {
    const prices = channelRows.map((channel): ProductChannelPrice => {
      const item = byKey.get(`${productId}:${channel.id}`)

      return {
        channelId: channel.id,
        channelName: channel.name,
        channelCurrency: channel.currency,
        itemId: item?.id ?? null,
        price: item ? Number(item.price) : null,
        status: item?.status ?? null,
      }
    })

    byProduct.set(productId, prices)
  }

  return byProduct
}

catalogRoutes.get('/products', queryParams(listProductsQuerySchema), async (c) => {
  const { search, status, type, channelId, page, pageSize } = c.req.valid('query')
  const db = c.get('db')
  const session = c.get('session')
  const isPartner = !isGlobalRole(session?.user.role)
  const resolvedChannelId = await resolveChannelId(c, channelId)
  const conditions: SQL[] = []

  if (search) {
    const term = `%${search}%`
    conditions.push(
      or(
        like(products.name, term),
        like(products.sku, term),
        like(products.barcode, term),
      ) as SQL,
    )
  }
  if (status) conditions.push(eq(products.status, status))
  if (type) conditions.push(eq(products.type, type))
  if (isPartner) conditions.push(eq(products.status, 'active'))
  if (isPartner && !resolvedChannelId) {
    return c.json({
      data: [],
      meta: { page, pageSize, total: 0, totalPages: 1 },
    })
  }
  if (isPartner && resolvedChannelId) {
    conditions.push(
      sql`exists (
        select 1 from ${channelPrices}
        where ${channelPrices.channelId} = ${resolvedChannelId}
          and ${channelPrices.productId} = ${products.id}
          and ${channelPrices.status} = 'active'
      )`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ total: count() }).from(products).where(where)
  const total = Number(totalRow?.total ?? 0)

  const rows = await db
    .select(productSelection)
    .from(products)
    .where(where)
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  const channelRows = await listMatrixChannels(db, isPartner, resolvedChannelId)
  const pricesByProduct = await buildProductPrices(
    db,
    rows.map((row) => row.id),
    channelRows,
  )

  return c.json({
    data: rows.map((row): CatalogProduct => {
      const product = serializeProduct(row)
      const prices = pricesByProduct.get(row.id) ?? []
      const resolved = resolvedChannelId
        ? prices.find((price) => price.channelId === resolvedChannelId)
        : undefined

      return {
        ...product,
        priceItemId: resolved?.itemId ?? null,
        price: resolved?.price ?? null,
        priceStatus: resolved?.status ?? null,
        position: 0,
        prices,
      }
    }),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

catalogRoutes.get('/products/:id', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const product = await findProduct(db, id)

  if (!product) throw notFound('No encontramos este producto.')

  await assertPartnerProductAccess(c, product)

  const session = c.get('session')
  const isPartner = !isGlobalRole(session?.user.role)
  const partnerChannelId = isPartner
    ? await findPartnerChannelId(db, session?.user.partnerId ?? null)
    : null
  const resolvedChannelId = await resolveChannelId(c, c.req.query('channelId'))
  const channelRows = await listMatrixChannels(db, isPartner, partnerChannelId)
  const pricesByProduct = await buildProductPrices(db, [id], channelRows)
  const prices = pricesByProduct.get(id) ?? []
  const resolved = resolvedChannelId
    ? prices.find((price) => price.channelId === resolvedChannelId)
    : undefined

  if (isPartner && resolvedChannelId && (!resolved?.itemId || resolved.status !== 'active')) {
    throw notFound('No encontramos este producto en tu canal de precios.')
  }

  const components = await db
    .select({
      id: productComponents.id,
      componentProductId: productComponents.componentProductId,
      componentSku: products.sku,
      componentName: products.name,
      componentType: products.type,
      quantity: productComponents.quantity,
      position: productComponents.position,
    })
    .from(productComponents)
    .innerJoin(products, eq(products.id, productComponents.componentProductId))
    .where(eq(productComponents.productId, id))
    .orderBy(asc(productComponents.position))

  const detail: CatalogProduct & { components: ProductComponent[] } = {
    ...product,
    priceItemId: resolved?.itemId ?? null,
    price: resolved?.price ?? null,
    priceStatus: resolved?.status ?? null,
    position: 0,
    prices,
    components,
  }

  return c.json({ data: detail })
})

catalogRoutes.get('/products/:id/history', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const channelId = await resolveChannelId(c, c.req.query('channelId'))

  if (!channelId) {
    throw badRequest('Selecciona un canal de precios para ver el historial.')
  }

  await assertChannelAccess(c, channelId)

  const rows = await db
    .select({
      id: priceHistory.id,
      channelId: priceHistory.channelId,
      productId: priceHistory.productId,
      productSku: products.sku,
      productName: products.name,
      oldPrice: priceHistory.oldPrice,
      newPrice: priceHistory.newPrice,
      currency: priceHistory.currency,
      changedBy: priceHistory.changedBy,
      changedByName: priceHistory.changedByName,
      createdAt: priceHistory.createdAt,
    })
    .from(priceHistory)
    .innerJoin(products, eq(products.id, priceHistory.productId))
    .where(and(eq(priceHistory.productId, id), eq(priceHistory.channelId, channelId)))
    .orderBy(desc(priceHistory.createdAt))
    .limit(200)

  return c.json({ data: rows.map(serializeHistory) })
})

catalogRoutes.post('/products', jsonBody(createProductSchema), async (c) => {
  const session = requireAdminSession(c)
  const body = c.req.valid('json')
  const db = c.get('db')
  const sku = body.sku.trim()
  const barcode = nullable(body.barcode)

  await assertUniqueProduct(db, { sku, barcode })

  const id = newId()
  await db.insert(products).values({
    id,
    sku,
    barcode,
    name: body.name,
    type: body.type,
    ivaEnabled: body.ivaEnabled,
    status: body.status,
    trackInventory: body.trackInventory,
  })

  await writeAudit(c, {
    action: 'catalog.product.create',
    entityType: 'product',
    entityId: id,
    partnerId: null,
    description: `Creó el producto ${body.name} (${sku}).`,
    metadata: { sku, type: body.type, ivaEnabled: body.ivaEnabled },
  })

  return c.json({ data: await findProduct(db, id) }, 201)
})

catalogRoutes.patch('/products/:id', jsonBody(updateProductSchema), async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')
  const existing = await findProduct(db, id)

  if (!existing) throw notFound('No encontramos este producto.')

  const nextSku = body.sku ?? existing.sku
  const nextBarcode = body.barcode !== undefined ? nullable(body.barcode) : existing.barcode

  if (body.sku !== undefined || body.barcode !== undefined) {
    await assertUniqueProduct(db, { sku: nextSku, barcode: nextBarcode, excludeId: id })
  }

  const patch: Partial<typeof products.$inferInsert> = { updatedAt: new Date() }
  if (body.sku !== undefined) patch.sku = body.sku.trim()
  if (body.barcode !== undefined) patch.barcode = nextBarcode
  if (body.name !== undefined) patch.name = body.name
  if (body.type !== undefined) patch.type = body.type
  if (body.ivaEnabled !== undefined) patch.ivaEnabled = body.ivaEnabled
  if (body.status !== undefined) patch.status = body.status
  if (body.trackInventory !== undefined) patch.trackInventory = body.trackInventory

  await db.update(products).set(patch).where(eq(products.id, id))

  await writeAudit(c, {
    action: 'catalog.product.update',
    entityType: 'product',
    entityId: id,
    partnerId: null,
    description: `Actualizó el producto ${body.name ?? existing.name}.`,
    metadata: body,
  })

  return c.json({ data: await findProduct(db, id) })
})

catalogRoutes.delete('/products/:id', async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const db = c.get('db')
  const existing = await findProduct(db, id)

  if (!existing) throw notFound('No encontramos este producto.')

  await assertProductUnused(db, id)
  await db.delete(products).where(eq(products.id, id))

  await writeAudit(c, {
    action: 'catalog.product.delete',
    entityType: 'product',
    entityId: id,
    partnerId: null,
    description: `Eliminó el producto ${existing.name}.`,
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.get('/products/:id/components', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const product = await findProduct(db, id)

  if (!product) throw notFound('No encontramos este producto.')

  await assertPartnerProductAccess(c, product)

  const rows = await db
    .select({
      id: productComponents.id,
      componentProductId: productComponents.componentProductId,
      componentSku: products.sku,
      componentName: products.name,
      componentType: products.type,
      quantity: productComponents.quantity,
      position: productComponents.position,
    })
    .from(productComponents)
    .innerJoin(products, eq(products.id, productComponents.componentProductId))
    .where(eq(productComponents.productId, id))
    .orderBy(asc(productComponents.position))

  return c.json({ data: rows })
})

catalogRoutes.put(
  '/products/:id/components',
  jsonBody(setProductComponentsSchema),
  async (c) => {
    requireAdminSession(c)
    const id = c.req.param('id')
    const body = c.req.valid('json')
    const db = c.get('db')
    const product = await findProduct(db, id)

    if (!product) throw notFound('No encontramos este producto.')
    if (product.type !== 'promotion') {
      throw badRequest('Solo las promociones pueden tener componentes.')
    }

    const ids = body.components.map((component) => component.componentProductId)

    if (new Set(ids).size !== ids.length) {
      throw badRequest('Un componente está repetido en la promoción.')
    }
    if (ids.includes(id)) {
      throw badRequest('Una promoción no puede ser componente de sí misma.')
    }

    if (ids.length > 0) {
      const rows = await db
        .select({ id: products.id, name: products.name, type: products.type })
        .from(products)
        .where(inArray(products.id, ids))

      const byId = new Map(rows.map((row) => [row.id, row]))

      for (const component of body.components) {
        const found = byId.get(component.componentProductId)
        if (!found) {
          throw badRequest('Uno de los componentes no existe.')
        }
        if (found.type === 'promotion') {
          throw badRequest('Una promoción no puede contener otra promoción.')
        }
      }
    }

    const statements: unknown[] = [
      db.delete(productComponents).where(eq(productComponents.productId, id)),
    ]

    if (body.components.length > 0) {
      statements.push(
        db.insert(productComponents).values(
          body.components.map((component, index) => ({
            id: newId(),
            productId: id,
            componentProductId: component.componentProductId,
            quantity: component.quantity,
            position: component.position ?? index,
          })),
        ),
      )
    }

    await db.batch(statements as never)

    await writeAudit(c, {
      action: 'catalog.components.set',
      entityType: 'product',
      entityId: id,
      partnerId: null,
      description: `Actualizó los componentes de ${product.name}.`,
      metadata: { components: body.components },
    })

    return c.json({ data: { ok: true } })
  },
)

catalogRoutes.get('/channels/options', async (c) => {
  const db = c.get('db')
  const session = c.get('session')
  const currency = c.req.query('currency')
  const status = c.req.query('status')
  const isPartner = !isGlobalRole(session?.user.role)
  const partnerChannelId = isPartner
    ? await findPartnerChannelId(db, session?.user.partnerId ?? null)
    : null
  const conditions: SQL[] = []

  if (status) conditions.push(eq(channels.status, status as Channel['status']))
  if (currency) conditions.push(eq(channels.currency, currency as Channel['currency']))
  if (isPartner) {
    if (!partnerChannelId) return c.json({ data: [] })
    conditions.push(eq(channels.id, partnerChannelId))
  }

  const rows = await db
    .select({
      id: channels.id,
      name: channels.name,
      currency: channels.currency,
      status: channels.status,
    })
    .from(channels)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(
      sql`case when lower(${channels.name}) like 'principal%' then 0 else 1 end`,
      asc(channels.name),
    )

  return c.json({ data: rows })
})

catalogRoutes.get('/channels', queryParams(listChannelsQuerySchema), async (c) => {
  const { search, status, currency, page, pageSize } = c.req.valid('query')
  const db = c.get('db')
  const session = c.get('session')
  const isPartner = !isGlobalRole(session?.user.role)
  const partnerChannelId = isPartner
    ? await findPartnerChannelId(db, session?.user.partnerId ?? null)
    : null
  const conditions: SQL[] = []

  if (search) conditions.push(like(channels.name, `%${search}%`))
  if (status) conditions.push(eq(channels.status, status))
  if (currency) conditions.push(eq(channels.currency, currency))
  if (isPartner) {
    if (!partnerChannelId) {
      return c.json({
        data: [],
        meta: { page, pageSize, total: 0, totalPages: 1 },
      })
    }
    conditions.push(eq(channels.id, partnerChannelId))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ total: count() }).from(channels).where(where)
  const total = Number(totalRow?.total ?? 0)

  const rows = await db
    .select({
      id: channels.id,
      name: channels.name,
      currency: channels.currency,
      status: channels.status,
      description: channels.description,
      itemCount: count(channelPrices.id),
      createdAt: channels.createdAt,
      updatedAt: channels.updatedAt,
    })
    .from(channels)
    .leftJoin(channelPrices, eq(channelPrices.channelId, channels.id))
    .where(where)
    .groupBy(channels.id)
    .orderBy(
      sql`case when lower(${channels.name}) like 'principal%' then 0 else 1 end`,
      asc(channels.name),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return c.json({
    data: rows.map(serializeChannel),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

catalogRoutes.get('/channels/:id', async (c) => {
  const id = c.req.param('id')
  await assertChannelAccess(c, id)
  const channel = await findChannel(c.get('db'), id)

  if (!channel) throw notFound('No encontramos este canal de precios.')

  return c.json({ data: channel })
})

catalogRoutes.post('/channels', jsonBody(createChannelSchema), async (c) => {
  requireAdminSession(c)
  const body = c.req.valid('json')
  const db = c.get('db')

  const [existing] = await db
    .select({ id: channels.id })
    .from(channels)
    .where(eq(channels.name, body.name))
    .limit(1)

  if (existing) throw conflict('Ya existe un canal con ese nombre.')

  const id = newId()
  await db.insert(channels).values({
    id,
    name: body.name,
    currency: body.currency,
    status: body.status,
    description: nullable(body.description),
  })

  await writeAudit(c, {
    action: 'catalog.channel.create',
    entityType: 'channel',
    entityId: id,
    partnerId: null,
    description: `Creó el canal de precios ${body.name}.`,
    metadata: { currency: body.currency },
  })

  return c.json({ data: await findChannel(db, id) }, 201)
})

catalogRoutes.patch('/channels/:id', jsonBody(updateChannelSchema), async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')
  const existing = await findChannel(db, id)

  if (!existing) throw notFound('No encontramos este canal de precios.')

  if (body.name && body.name !== existing.name) {
    const [duplicate] = await db
      .select({ id: channels.id })
      .from(channels)
      .where(eq(channels.name, body.name))
      .limit(1)
    if (duplicate) throw conflict('Ya existe un canal con ese nombre.')
  }

  if (body.currency && body.currency !== existing.currency) {
    const [usedByPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.channelId, id))
      .limit(1)
    const [usedBySale] = await db
      .select({ id: sql<string>`1` })
      .from(sales)
      .where(eq(sales.channelId, id))
      .limit(1)

    if (usedByPartner || usedBySale) {
      throw new AppError(
        409,
        'CHANNEL_CURRENCY_LOCKED',
        'No puedes cambiar la moneda de un canal que ya tiene aliados o ventas asociadas.',
      )
    }
  }

  const patch: Partial<typeof channels.$inferInsert> = { updatedAt: new Date() }
  if (body.name !== undefined) patch.name = body.name
  if (body.currency !== undefined) patch.currency = body.currency
  if (body.status !== undefined) patch.status = body.status
  if (body.description !== undefined) patch.description = nullable(body.description)

  await db.update(channels).set(patch).where(eq(channels.id, id))

  await writeAudit(c, {
    action: 'catalog.channel.update',
    entityType: 'channel',
    entityId: id,
    partnerId: null,
    description: `Actualizó el canal ${body.name ?? existing.name}.`,
    metadata: body,
  })

  return c.json({ data: await findChannel(db, id) })
})

catalogRoutes.delete('/channels/:id', async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const db = c.get('db')
  const existing = await findChannel(db, id)

  if (!existing) throw notFound('No encontramos este canal de precios.')

  const [usedByPartner] = await db
    .select({ total: count() })
    .from(partners)
    .where(eq(partners.channelId, id))
  const [usedBySale] = await db
    .select({ total: count() })
    .from(sales)
    .where(eq(sales.channelId, id))

  if (Number(usedByPartner?.total ?? 0) > 0 || Number(usedBySale?.total ?? 0) > 0) {
    throw conflict('El canal tiene aliados o ventas asociadas. Desactívalo en lugar de eliminarlo.')
  }

  await db.delete(channels).where(eq(channels.id, id))

  await writeAudit(c, {
    action: 'catalog.channel.delete',
    entityType: 'channel',
    entityId: id,
    partnerId: null,
    description: `Eliminó el canal ${existing.name}.`,
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.get('/channels/:id/prices', async (c) => {
  const id = c.req.param('id')
  await assertChannelAccess(c, id)
  const db = c.get('db')
  const search = c.req.query('search')?.trim()
  const status = c.req.query('status')
  const conditions: SQL[] = [eq(channelPrices.channelId, id)]

  if (status) conditions.push(eq(channelPrices.status, status as ChannelPriceStatus))
  if (search) {
    const term = `%${search}%`
    conditions.push(
      or(
        like(products.name, term),
        like(products.sku, term),
        like(products.barcode, term),
      ) as SQL,
    )
  }

  const rows = await db
    .select({
      id: channelPrices.id,
      channelId: channelPrices.channelId,
      productId: channelPrices.productId,
      productSku: products.sku,
      productName: products.name,
      productType: products.type,
      productIvaEnabled: products.ivaEnabled,
      price: channelPrices.price,
      status: channelPrices.status,
      position: channelPrices.position,
      createdAt: channelPrices.createdAt,
      updatedAt: channelPrices.updatedAt,
    })
    .from(channelPrices)
    .innerJoin(products, eq(products.id, channelPrices.productId))
    .where(and(...conditions))
    .orderBy(asc(channelPrices.position), asc(products.name))

  return c.json({ data: rows.map(serializeChannelPrice) })
})

catalogRoutes.post('/channels/:id/prices', async (c) => {
  const session = requireAdminSession(c)
  const channelId = c.req.param('id')
  const db = c.get('db')
  const body = (await c.req.json()) as {
    productId?: string
    price?: number | string
    status?: ChannelPriceStatus
    position?: number
  }

  const productId = body.productId?.trim()
  if (!productId) throw badRequest('Selecciona un producto.')

  const price = Number(String(body.price ?? '').replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) {
    throw badRequest('Usa un precio válido.')
  }

  const channel = await findChannel(db, channelId)
  if (!channel) throw notFound('No encontramos este canal de precios.')

  const product = await findProduct(db, productId)
  if (!product) throw badRequest('El producto seleccionado no existe.')

  const [existing] = await db
    .select({ id: channelPrices.id })
    .from(channelPrices)
    .where(
      and(eq(channelPrices.channelId, channelId), eq(channelPrices.productId, productId)),
    )
    .limit(1)

  if (existing) {
    throw conflict('El producto ya está en este canal. Edita su precio en lugar de agregarlo.')
  }

  const id = newId()
  await db.batch([
    db.insert(channelPrices).values({
      id,
      channelId,
      productId,
      price,
      status: body.status ?? 'active',
      position: body.position ?? 0,
    }),
    db.insert(priceHistory).values({
      id: newId(),
      channelId,
      productId,
      oldPrice: null,
      newPrice: price,
      currency: channel.currency,
      changedBy: session.user.id,
      changedByName: session.user.name,
    }),
  ])

  await writeAudit(c, {
    action: 'catalog.channel.price.create',
    entityType: 'channel_price',
    entityId: id,
    partnerId: null,
    description: `Agregó ${product.name} al canal ${channel.name}.`,
    metadata: { price, currency: channel.currency },
  })

  return c.json({ data: { ok: true, id } }, 201)
})

catalogRoutes.put(
  '/channels/:id/prices/by-product/:productId',
  jsonBody(setChannelPriceSchema),
  async (c) => {
    const session = requireAdminSession(c)
    const channelId = c.req.param('id')
    const productId = c.req.param('productId')
    const body = c.req.valid('json')
    const db = c.get('db')

    const channel = await findChannel(db, channelId)
    if (!channel) throw notFound('No encontramos este canal de precios.')

    const product = await findProduct(db, productId)
    if (!product) throw badRequest('El producto seleccionado no existe.')

    const [existing] = await db
      .select({
        id: channelPrices.id,
        price: channelPrices.price,
        status: channelPrices.status,
      })
      .from(channelPrices)
      .where(
        and(eq(channelPrices.channelId, channelId), eq(channelPrices.productId, productId)),
      )
      .limit(1)

    const itemId = existing?.id ?? newId()
    const statements: unknown[] = []

    if (existing) {
      statements.push(
        db
          .update(channelPrices)
          .set({ price: body.price, status: body.status, updatedAt: new Date() })
          .where(eq(channelPrices.id, existing.id)),
      )
    } else {
      statements.push(
        db.insert(channelPrices).values({
          id: itemId,
          channelId,
          productId,
          price: body.price,
          status: body.status,
          position: 0,
        }),
      )
    }

    if (!existing || Number(existing.price) !== body.price) {
      statements.push(
        db.insert(priceHistory).values({
          id: newId(),
          channelId,
          productId,
          oldPrice: existing ? Number(existing.price) : null,
          newPrice: body.price,
          currency: channel.currency,
          changedBy: session.user.id,
          changedByName: session.user.name,
        }),
      )
    }

    await db.batch(statements as never)

    await writeAudit(c, {
      action: existing ? 'catalog.channel.price.update' : 'catalog.channel.price.create',
      entityType: 'channel_price',
      entityId: itemId,
      partnerId: null,
      description: `Definió el precio de ${product.name} en el canal ${channel.name}.`,
      metadata: { price: body.price, status: body.status, currency: channel.currency },
    })

    return c.json({
      data: { ok: true, itemId, price: body.price, status: body.status },
    })
  },
)

catalogRoutes.patch('/channels/:id/prices/:itemId', async (c) => {
  const session = requireAdminSession(c)
  const channelId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const db = c.get('db')
  const body = (await c.req.json()) as {
    price?: number | string
    status?: ChannelPriceStatus
    position?: number
  }

  const channel = await findChannel(db, channelId)
  if (!channel) throw notFound('No encontramos este canal de precios.')

  const [existing] = await db
    .select({
      id: channelPrices.id,
      productId: channelPrices.productId,
      price: channelPrices.price,
    })
    .from(channelPrices)
    .where(and(eq(channelPrices.id, itemId), eq(channelPrices.channelId, channelId)))
    .limit(1)

  if (!existing) throw notFound('No encontramos este precio en el canal.')

  const patch: Partial<typeof channelPrices.$inferInsert> = { updatedAt: new Date() }
  let nextPrice = Number(existing.price)

  if (body.price !== undefined) {
    const parsed = Number(String(body.price).replace(',', '.'))
    if (!Number.isFinite(parsed) || parsed < 0) throw badRequest('Usa un precio válido.')
    nextPrice = parsed
    patch.price = parsed
  }
  if (body.status !== undefined) patch.status = body.status
  if (body.position !== undefined) patch.position = body.position

  const statements: unknown[] = [
    db.update(channelPrices).set(patch).where(eq(channelPrices.id, itemId)),
  ]

  if (nextPrice !== Number(existing.price)) {
    statements.push(
      db.insert(priceHistory).values({
        id: newId(),
        channelId,
        productId: existing.productId,
        oldPrice: Number(existing.price),
        newPrice: nextPrice,
        currency: channel.currency,
        changedBy: session.user.id,
        changedByName: session.user.name,
      }),
    )
  }

  await db.batch(statements as never)

  await writeAudit(c, {
    action: 'catalog.channel.price.update',
    entityType: 'channel_price',
    entityId: itemId,
    partnerId: null,
    description: `Actualizó un precio del canal ${channel.name}.`,
    metadata: { price: nextPrice },
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.delete('/channels/:id/prices/:itemId', async (c) => {
  requireAdminSession(c)
  const channelId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const db = c.get('db')
  const channel = await findChannel(db, channelId)

  if (!channel) throw notFound('No encontramos este canal de precios.')

  const [existing] = await db
    .select({ id: channelPrices.id })
    .from(channelPrices)
    .where(and(eq(channelPrices.id, itemId), eq(channelPrices.channelId, channelId)))
    .limit(1)

  if (!existing) throw notFound('No encontramos este precio en el canal.')

  await db.delete(channelPrices).where(eq(channelPrices.id, itemId))

  await writeAudit(c, {
    action: 'catalog.channel.price.delete',
    entityType: 'channel_price',
    entityId: itemId,
    partnerId: null,
    description: `Quitó un producto del canal ${channel.name}.`,
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.put(
  '/channels/:id/prices',
  jsonBody(syncChannelPricesSchema),
  async (c) => {
    const session = requireAdminSession(c)
    const channelId = c.req.param('id')
    const body = c.req.valid('json')
    const db = c.get('db')
    const channel = await findChannel(db, channelId)

    if (!channel) throw notFound('No encontramos este canal de precios.')

    const productIds = body.items.map((item) => item.productId)
    if (new Set(productIds).size !== productIds.length) {
      throw badRequest('Hay productos repetidos en el canal.')
    }

    const existingRows = await db
      .select({
        id: channelPrices.id,
        productId: channelPrices.productId,
        price: channelPrices.price,
      })
      .from(channelPrices)
      .where(eq(channelPrices.channelId, channelId))
    const existingByProduct = new Map(existingRows.map((row) => [row.productId, row]))

    const productsFound = await db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(inArray(products.id, productIds))
    const productById = new Map(productsFound.map((row) => [row.id, row]))

    for (const item of body.items) {
      if (!productById.has(item.productId)) {
        throw badRequest('Uno de los productos seleccionados no existe.')
      }
    }

    const statements: unknown[] = []

    for (const item of body.items) {
      const existing = existingByProduct.get(item.productId)

      if (existing) {
        statements.push(
          db
            .update(channelPrices)
            .set({
              price: item.price,
              status: item.status,
              position: item.position,
              updatedAt: new Date(),
            })
            .where(eq(channelPrices.id, existing.id)),
        )

        if (Number(existing.price) !== item.price) {
          statements.push(
            db.insert(priceHistory).values({
              id: newId(),
              channelId,
              productId: item.productId,
              oldPrice: Number(existing.price),
              newPrice: item.price,
              currency: channel.currency,
              changedBy: session.user.id,
              changedByName: session.user.name,
            }),
          )
        }
      } else {
        statements.push(
          db.insert(channelPrices).values({
            id: newId(),
            channelId,
            productId: item.productId,
            price: item.price,
            status: item.status,
            position: item.position,
          }),
          db.insert(priceHistory).values({
            id: newId(),
            channelId,
            productId: item.productId,
            oldPrice: null,
            newPrice: item.price,
            currency: channel.currency,
            changedBy: session.user.id,
            changedByName: session.user.name,
          }),
        )
      }
    }

    if (statements.length > 0) {
      await db.batch(statements as never)
    }

    await writeAudit(c, {
      action: 'catalog.channel.prices.sync',
      entityType: 'channel',
      entityId: channelId,
      partnerId: null,
      description: `Sincronizó ${body.items.length} precio(s) del canal ${channel.name}.`,
      metadata: { count: body.items.length },
    })

    return c.json({ data: { ok: true, count: body.items.length } })
  },
)
