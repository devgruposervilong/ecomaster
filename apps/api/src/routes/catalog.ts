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
  createPriceListSchema,
  createProductSchema,
  isGlobalRole,
  listPriceListsQuerySchema,
  listProductsQuerySchema,
  setProductComponentsSchema,
  syncPriceListItemsSchema,
  updatePriceListSchema,
  updateProductSchema,
  type CatalogProduct,
  type PriceHistoryEntry,
  type PriceList,
  type PriceListItem,
  type Product,
  type ProductComponent,
  type ProductType,
} from '@ecomaster/shared'
import {
  partners,
  priceHistory,
  priceListItems,
  priceLists,
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

async function findPartnerPriceListId(db: Db, partnerId: string | null) {
  if (!partnerId) return null

  const [row] = await db
    .select({ priceListId: partners.priceListId })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1)

  return row?.priceListId ?? null
}

async function resolveListId(c: Context<AppEnv>, requested?: string) {
  const session = c.get('session')

  if (!session) return requested ?? null
  if (isGlobalRole(session.user.role)) return requested ?? null

  return findPartnerPriceListId(c.get('db'), session.user.partnerId ?? null)
}

async function assertListAccess(c: Context<AppEnv>, listId: string) {
  const session = c.get('session')

  if (!session) throw forbidden('Debes iniciar sesión.')

  if (isGlobalRole(session.user.role)) {
    const [list] = await c
      .get('db')
      .select({ id: priceLists.id })
      .from(priceLists)
      .where(eq(priceLists.id, listId))
      .limit(1)

    if (!list) throw notFound('No encontramos esta lista de precios.')
    return
  }

  const partnerListId = await findPartnerPriceListId(c.get('db'), session.user.partnerId ?? null)

  if (partnerListId !== listId) {
    throw forbidden('No tienes acceso a esta lista de precios.')
  }
}

async function findProduct(db: Db, id: string) {
  const [row] = await db.select(productSelection).from(products).where(eq(products.id, id)).limit(1)
  return row ? serializeProduct(row) : null
}

async function assertPartnerProductAccess(
  c: Context<AppEnv>,
  product: Product,
) {
  const session = c.get('session')

  if (!session) throw forbidden('Debes iniciar sesión.')
  if (isGlobalRole(session.user.role)) return

  const listId = await findPartnerPriceListId(c.get('db'), session.user.partnerId ?? null)

  if (!listId || product.status !== 'active') {
    throw notFound('No encontramos este producto en tu lista de precios.')
  }

  const [item] = await c
    .get('db')
    .select({ status: priceListItems.status })
    .from(priceListItems)
    .where(
      and(eq(priceListItems.priceListId, listId), eq(priceListItems.productId, product.id)),
    )
    .limit(1)

  if (!item || item.status !== 'active') {
    throw notFound('No encontramos este producto en tu lista de precios.')
  }
}

async function findPriceList(db: Db, id: string) {
  const [row] = await db
    .select({
      id: priceLists.id,
      name: priceLists.name,
      currency: priceLists.currency,
      status: priceLists.status,
      description: priceLists.description,
      itemCount: sql<number>`(
        select count(*) from ${priceListItems}
        where ${priceListItems.priceListId} = ${priceLists.id}
      )`,
      createdAt: priceLists.createdAt,
      updatedAt: priceLists.updatedAt,
    })
    .from(priceLists)
    .where(eq(priceLists.id, id))
    .limit(1)

  return row ? serializePriceList(row) : null
}

function serializePriceList(row: {
  id: string
  name: string
  currency: PriceList['currency']
  status: PriceList['status']
  description: string | null
  itemCount: number
  createdAt: Date
  updatedAt: Date
}): PriceList {
  return {
    ...row,
    itemCount: Number(row.itemCount ?? 0),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializePriceListItem(row: {
  id: string
  priceListId: string
  productId: string
  productSku: string
  productName: string
  productType: ProductType
  productIvaEnabled: boolean
  price: number
  status: PriceListItem['status']
  position: number
  createdAt: Date
  updatedAt: Date
}): PriceListItem {
  return {
    ...row,
    price: Number(row.price),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function serializeHistory(row: {
  id: string
  priceListId: string
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
    .from(priceListItems)
    .where(eq(priceListItems.productId, productId))
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

catalogRoutes.get('/products', queryParams(listProductsQuerySchema), async (c) => {
  const { search, status, type, priceListId, page, pageSize } = c.req.valid('query')
  const db = c.get('db')
  const session = c.get('session')
  const listId = await resolveListId(c, priceListId)
  const isPartner = !isGlobalRole(session?.user.role)
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
  if (isPartner && !listId) {
    return c.json({
      data: [],
      meta: { page, pageSize, total: 0, totalPages: 1 },
    })
  }
  if (listId) {
    conditions.push(
      sql`exists (
        select 1 from ${priceListItems}
        where ${priceListItems.priceListId} = ${listId}
          and ${priceListItems.productId} = ${products.id}
          and (${isPartner ? sql`${priceListItems.status} = 'active'` : sql`1 = 1`})
      )`,
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ total: count() }).from(products).where(where)
  const total = Number(totalRow?.total ?? 0)

  const baseQuery = db.select(productSelection).from(products)
  const rows = await baseQuery
    .where(where)
    .orderBy(asc(products.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  let priceByProduct = new Map<
    string,
    { id: string; price: number; status: PriceListItem['status']; position: number }
  >()

  if (listId) {
    const ids = rows.map((row) => row.id)
    if (ids.length > 0) {
      const items = await db
        .select({
          id: priceListItems.id,
          productId: priceListItems.productId,
          price: priceListItems.price,
          status: priceListItems.status,
          position: priceListItems.position,
        })
        .from(priceListItems)
        .where(
          and(
            eq(priceListItems.priceListId, listId),
            inArray(priceListItems.productId, ids),
          ),
        )

      priceByProduct = new Map(
        items.map((item) => [
          item.productId,
          {
            id: item.id,
            price: Number(item.price),
            status: item.status,
            position: item.position,
          },
        ]),
      )
    }
  }

  return c.json({
    data: rows.map((row): CatalogProduct => {
      const product = serializeProduct(row)
      const price = priceByProduct.get(row.id)

      return {
        ...product,
        priceItemId: price?.id ?? null,
        price: price?.price ?? null,
        priceStatus: price?.status ?? null,
        position: price?.position ?? 0,
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
  const listId = await resolveListId(c, c.req.query('priceListId'))
  let price: number | null = null
  let priceItemId: string | null = null
  let priceStatus: PriceListItem['status'] | null = null
  let position = 0

  if (listId) {
    const [item] = await db
      .select({
        id: priceListItems.id,
        price: priceListItems.price,
        status: priceListItems.status,
        position: priceListItems.position,
      })
      .from(priceListItems)
      .where(
        and(eq(priceListItems.priceListId, listId), eq(priceListItems.productId, id)),
      )
      .limit(1)

    if (isPartner && (!item || item.status !== 'active')) {
      throw notFound('No encontramos este producto en tu lista de precios.')
    }

    if (item) {
      price = Number(item.price)
      priceItemId = item.id
      priceStatus = item.status
      position = item.position
    }
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
    priceItemId,
    price,
    priceStatus,
    position,
    components,
  }

  return c.json({ data: detail })
})

catalogRoutes.get('/products/:id/history', async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const listId = await resolveListId(c, c.req.query('priceListId'))

  if (!listId) {
    throw badRequest('Selecciona una lista de precios para ver el historial.')
  }

  await assertListAccess(c, listId)

  const rows = await db
    .select({
      id: priceHistory.id,
      priceListId: priceHistory.priceListId,
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
    .where(and(eq(priceHistory.productId, id), eq(priceHistory.priceListId, listId)))
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

catalogRoutes.get('/price-lists/options', async (c) => {
  const db = c.get('db')
  const session = c.get('session')
  const currency = c.req.query('currency')
  const status = c.req.query('status')
  const isPartner = !isGlobalRole(session?.user.role)
  const partnerListId = isPartner
    ? await findPartnerPriceListId(db, session?.user.partnerId ?? null)
    : null
  const conditions: SQL[] = []

  if (status) conditions.push(eq(priceLists.status, status as PriceList['status']))
  if (currency) conditions.push(eq(priceLists.currency, currency as PriceList['currency']))
  if (isPartner) {
    if (!partnerListId) return c.json({ data: [] })
    conditions.push(eq(priceLists.id, partnerListId))
  }

  const rows = await db
    .select({
      id: priceLists.id,
      name: priceLists.name,
      currency: priceLists.currency,
      status: priceLists.status,
    })
    .from(priceLists)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(priceLists.name))

  return c.json({ data: rows })
})

catalogRoutes.get('/price-lists', queryParams(listPriceListsQuerySchema), async (c) => {
  const { search, status, currency, page, pageSize } = c.req.valid('query')
  const db = c.get('db')
  const session = c.get('session')
  const isPartner = !isGlobalRole(session?.user.role)
  const partnerListId = isPartner
    ? await findPartnerPriceListId(db, session?.user.partnerId ?? null)
    : null
  const conditions: SQL[] = []

  if (search) conditions.push(like(priceLists.name, `%${search}%`))
  if (status) conditions.push(eq(priceLists.status, status))
  if (currency) conditions.push(eq(priceLists.currency, currency))
  if (isPartner) {
    if (!partnerListId) {
      return c.json({
        data: [],
        meta: { page, pageSize, total: 0, totalPages: 1 },
      })
    }
    conditions.push(eq(priceLists.id, partnerListId))
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ total: count() }).from(priceLists).where(where)
  const total = Number(totalRow?.total ?? 0)

  const rows = await db
    .select({
      id: priceLists.id,
      name: priceLists.name,
      currency: priceLists.currency,
      status: priceLists.status,
      description: priceLists.description,
      itemCount: sql<number>`(
        select count(*) from ${priceListItems}
        where ${priceListItems.priceListId} = ${priceLists.id}
      )`,
      createdAt: priceLists.createdAt,
      updatedAt: priceLists.updatedAt,
    })
    .from(priceLists)
    .where(where)
    .orderBy(asc(priceLists.name))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return c.json({
    data: rows.map(serializePriceList),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

catalogRoutes.get('/price-lists/:id', async (c) => {
  const id = c.req.param('id')
  await assertListAccess(c, id)
  const list = await findPriceList(c.get('db'), id)

  if (!list) throw notFound('No encontramos esta lista de precios.')

  return c.json({ data: list })
})

catalogRoutes.post('/price-lists', jsonBody(createPriceListSchema), async (c) => {
  requireAdminSession(c)
  const body = c.req.valid('json')
  const db = c.get('db')

  const [existing] = await db
    .select({ id: priceLists.id })
    .from(priceLists)
    .where(eq(priceLists.name, body.name))
    .limit(1)

  if (existing) throw conflict('Ya existe una lista de precios con ese nombre.')

  const id = newId()
  await db.insert(priceLists).values({
    id,
    name: body.name,
    currency: body.currency,
    status: body.status,
    description: nullable(body.description),
  })

  await writeAudit(c, {
    action: 'catalog.price_list.create',
    entityType: 'price_list',
    entityId: id,
    partnerId: null,
    description: `Creó la lista de precios ${body.name}.`,
    metadata: { currency: body.currency },
  })

  return c.json({ data: await findPriceList(db, id) }, 201)
})

catalogRoutes.patch('/price-lists/:id', jsonBody(updatePriceListSchema), async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const db = c.get('db')
  const existing = await findPriceList(db, id)

  if (!existing) throw notFound('No encontramos esta lista de precios.')

  if (body.name && body.name !== existing.name) {
    const [duplicate] = await db
      .select({ id: priceLists.id })
      .from(priceLists)
      .where(eq(priceLists.name, body.name))
      .limit(1)
    if (duplicate) throw conflict('Ya existe una lista de precios con ese nombre.')
  }

  if (body.currency && body.currency !== existing.currency) {
    const [usedByPartner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.priceListId, id))
      .limit(1)
    const [usedBySale] = await db
      .select({ id: sql<string>`1` })
      .from(sales)
      .where(eq(sales.priceListId, id))
      .limit(1)

    if (usedByPartner || usedBySale) {
      throw new AppError(
        409,
        'PRICE_LIST_CURRENCY_LOCKED',
        'No puedes cambiar la moneda de una lista que ya tiene aliados o ventas asociadas.',
      )
    }
  }

  const patch: Partial<typeof priceLists.$inferInsert> = { updatedAt: new Date() }
  if (body.name !== undefined) patch.name = body.name
  if (body.currency !== undefined) patch.currency = body.currency
  if (body.status !== undefined) patch.status = body.status
  if (body.description !== undefined) patch.description = nullable(body.description)

  await db.update(priceLists).set(patch).where(eq(priceLists.id, id))

  await writeAudit(c, {
    action: 'catalog.price_list.update',
    entityType: 'price_list',
    entityId: id,
    partnerId: null,
    description: `Actualizó la lista ${body.name ?? existing.name}.`,
    metadata: body,
  })

  return c.json({ data: await findPriceList(db, id) })
})

catalogRoutes.delete('/price-lists/:id', async (c) => {
  requireAdminSession(c)
  const id = c.req.param('id')
  const db = c.get('db')
  const existing = await findPriceList(db, id)

  if (!existing) throw notFound('No encontramos esta lista de precios.')

  const [usedByPartner] = await db
    .select({ total: count() })
    .from(partners)
    .where(eq(partners.priceListId, id))
  const [usedBySale] = await db
    .select({ total: count() })
    .from(sales)
    .where(eq(sales.priceListId, id))

  if (Number(usedByPartner?.total ?? 0) > 0 || Number(usedBySale?.total ?? 0) > 0) {
    throw conflict('La lista tiene aliados o ventas asociadas. Desactívala en lugar de eliminarla.')
  }

  await db.delete(priceLists).where(eq(priceLists.id, id))

  await writeAudit(c, {
    action: 'catalog.price_list.delete',
    entityType: 'price_list',
    entityId: id,
    partnerId: null,
    description: `Eliminó la lista ${existing.name}.`,
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.get('/price-lists/:id/items', async (c) => {
  const id = c.req.param('id')
  await assertListAccess(c, id)
  const db = c.get('db')
  const search = c.req.query('search')?.trim()
  const status = c.req.query('status')
  const conditions: SQL[] = [eq(priceListItems.priceListId, id)]

  if (status) conditions.push(eq(priceListItems.status, status as PriceListItem['status']))
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
      id: priceListItems.id,
      priceListId: priceListItems.priceListId,
      productId: priceListItems.productId,
      productSku: products.sku,
      productName: products.name,
      productType: products.type,
      productIvaEnabled: products.ivaEnabled,
      price: priceListItems.price,
      status: priceListItems.status,
      position: priceListItems.position,
      createdAt: priceListItems.createdAt,
      updatedAt: priceListItems.updatedAt,
    })
    .from(priceListItems)
    .innerJoin(products, eq(products.id, priceListItems.productId))
    .where(and(...conditions))
    .orderBy(asc(priceListItems.position), asc(products.name))

  return c.json({ data: rows.map(serializePriceListItem) })
})

catalogRoutes.post('/price-lists/:id/items', async (c) => {
  const session = requireAdminSession(c)
  const listId = c.req.param('id')
  const db = c.get('db')
  const body = (await c.req.json()) as {
    productId?: string
    price?: number | string
    status?: PriceListItem['status']
    position?: number
  }

  const productId = body.productId?.trim()
  if (!productId) throw badRequest('Selecciona un producto.')

  const price = Number(String(body.price ?? '').replace(',', '.'))
  if (!Number.isFinite(price) || price < 0) {
    throw badRequest('Usa un precio válido.')
  }

  const list = await findPriceList(db, listId)
  if (!list) throw notFound('No encontramos esta lista de precios.')

  const product = await findProduct(db, productId)
  if (!product) throw badRequest('El producto seleccionado no existe.')

  const [existing] = await db
    .select({ id: priceListItems.id })
    .from(priceListItems)
    .where(
      and(eq(priceListItems.priceListId, listId), eq(priceListItems.productId, productId)),
    )
    .limit(1)

  if (existing) {
    throw conflict('El producto ya está en esta lista. Edita su precio en lugar de agregarlo.')
  }

  const id = newId()
  await db.batch([
    db.insert(priceListItems).values({
      id,
      priceListId: listId,
      productId,
      price,
      status: body.status ?? 'active',
      position: body.position ?? 0,
    }),
    db.insert(priceHistory).values({
      id: newId(),
      priceListId: listId,
      productId,
      oldPrice: null,
      newPrice: price,
      currency: list.currency,
      changedBy: session.user.id,
      changedByName: session.user.name,
    }),
  ])

  await writeAudit(c, {
    action: 'catalog.price_list.item.create',
    entityType: 'price_list_item',
    entityId: id,
    partnerId: null,
    description: `Agregó ${product.name} a la lista ${list.name}.`,
    metadata: { price, currency: list.currency },
  })

  return c.json({ data: { ok: true, id } }, 201)
})

catalogRoutes.patch('/price-lists/:id/items/:itemId', async (c) => {
  const session = requireAdminSession(c)
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const db = c.get('db')
  const body = (await c.req.json()) as {
    price?: number | string
    status?: PriceListItem['status']
    position?: number
  }

  const list = await findPriceList(db, listId)
  if (!list) throw notFound('No encontramos esta lista de precios.')

  const [existing] = await db
    .select({
      id: priceListItems.id,
      productId: priceListItems.productId,
      price: priceListItems.price,
    })
    .from(priceListItems)
    .where(and(eq(priceListItems.id, itemId), eq(priceListItems.priceListId, listId)))
    .limit(1)

  if (!existing) throw notFound('No encontramos este precio en la lista.')

  const patch: Partial<typeof priceListItems.$inferInsert> = { updatedAt: new Date() }
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
    db.update(priceListItems).set(patch).where(eq(priceListItems.id, itemId)),
  ]

  if (nextPrice !== Number(existing.price)) {
    statements.push(
      db.insert(priceHistory).values({
        id: newId(),
        priceListId: listId,
        productId: existing.productId,
        oldPrice: Number(existing.price),
        newPrice: nextPrice,
        currency: list.currency,
        changedBy: session.user.id,
        changedByName: session.user.name,
      }),
    )
  }

  await db.batch(statements as never)

  await writeAudit(c, {
    action: 'catalog.price_list.item.update',
    entityType: 'price_list_item',
    entityId: itemId,
    partnerId: null,
    description: `Actualizó un precio de la lista ${list.name}.`,
    metadata: { price: nextPrice },
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.delete('/price-lists/:id/items/:itemId', async (c) => {
  requireAdminSession(c)
  const listId = c.req.param('id')
  const itemId = c.req.param('itemId')
  const db = c.get('db')
  const list = await findPriceList(db, listId)

  if (!list) throw notFound('No encontramos esta lista de precios.')

  const [existing] = await db
    .select({ id: priceListItems.id })
    .from(priceListItems)
    .where(and(eq(priceListItems.id, itemId), eq(priceListItems.priceListId, listId)))
    .limit(1)

  if (!existing) throw notFound('No encontramos este precio en la lista.')

  await db.delete(priceListItems).where(eq(priceListItems.id, itemId))

  await writeAudit(c, {
    action: 'catalog.price_list.item.delete',
    entityType: 'price_list_item',
    entityId: itemId,
    partnerId: null,
    description: `Quitó un producto de la lista ${list.name}.`,
  })

  return c.json({ data: { ok: true } })
})

catalogRoutes.put(
  '/price-lists/:id/items',
  jsonBody(syncPriceListItemsSchema),
  async (c) => {
    const session = requireAdminSession(c)
    const listId = c.req.param('id')
    const body = c.req.valid('json')
    const db = c.get('db')
    const list = await findPriceList(db, listId)

    if (!list) throw notFound('No encontramos esta lista de precios.')

    const productIds = body.items.map((item) => item.productId)
    if (new Set(productIds).size !== productIds.length) {
      throw badRequest('Hay productos repetidos en la lista.')
    }

    const existingRows = await db
      .select({
        id: priceListItems.id,
        productId: priceListItems.productId,
        price: priceListItems.price,
      })
      .from(priceListItems)
      .where(eq(priceListItems.priceListId, listId))
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
            .update(priceListItems)
            .set({
              price: item.price,
              status: item.status,
              position: item.position,
              updatedAt: new Date(),
            })
            .where(eq(priceListItems.id, existing.id)),
        )

        if (Number(existing.price) !== item.price) {
          statements.push(
            db.insert(priceHistory).values({
              id: newId(),
              priceListId: listId,
              productId: item.productId,
              oldPrice: Number(existing.price),
              newPrice: item.price,
              currency: list.currency,
              changedBy: session.user.id,
              changedByName: session.user.name,
            }),
          )
        }
      } else {
        statements.push(
          db.insert(priceListItems).values({
            id: newId(),
            priceListId: listId,
            productId: item.productId,
            price: item.price,
            status: item.status,
            position: item.position,
          }),
          db.insert(priceHistory).values({
            id: newId(),
            priceListId: listId,
            productId: item.productId,
            oldPrice: null,
            newPrice: item.price,
            currency: list.currency,
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
      action: 'catalog.price_list.items.sync',
      entityType: 'price_list',
      entityId: listId,
      partnerId: null,
      description: `Sincronizó ${body.items.length} precio(s) de la lista ${list.name}.`,
      metadata: { count: body.items.length },
    })

    return c.json({ data: { ok: true, count: body.items.length } })
  },
)
