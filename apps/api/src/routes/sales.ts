import {
  and,
  count,
  desc,
  eq,
  gte,
  inArray,
  like,
  lt,
  lte,
  or,
  type SQL,
} from 'drizzle-orm'
import { Hono, type Context } from 'hono'
import {
  cancelSaleSchema,
  createSaleSchema,
  isGlobalRole,
  isPartnerRole,
  listSalesQuerySchema,
  type Currency,
  type Sale,
  type SaleAmounts,
  type SaleDetail,
  type SaleItem,
  type SalePayment,
} from '@ecomaster/shared'
import {
  exchangeRates,
  partners,
  channelPrices,
  channels,
  productChannels,
  productComponents,
  products,
  saleItems,
  salePayments,
  sales,
} from '../db/schema'
import type { AppEnv } from '../env'
import { writeAudit } from '../lib/audit'
import { toBusinessDate } from '../lib/dates'
import { AppError, badRequest, conflict, forbidden, notFound } from '../lib/errors'
import { newId } from '../lib/ids'
import { calculateSale } from '../lib/sales-calculator'
import { jsonBody, queryParams } from '../lib/validation'

export const salesRoutes = new Hono<AppEnv>()

type Db = AppEnv['Variables']['db']
type Session = NonNullable<AppEnv['Variables']['session']>
type SaleRecord = typeof sales.$inferSelect
type SaleItemRecord = typeof saleItems.$inferSelect
type SalePaymentRecord = typeof salePayments.$inferSelect

function nullable(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function isAdminSession(session: Session) {
  return session.user.role === 'admin'
}

function requireAdminSession(c: Context<AppEnv>) {
  const session = c.get('session')

  if (!session || !isAdminSession(session)) {
    throw forbidden('Solo un administrador puede anular ventas.')
  }

  return session
}

function caracasStart(day: string) {
  return new Date(`${day}T00:00:00-04:00`)
}

function caracasNextDay(day: string) {
  return new Date(caracasStart(day).getTime() + 24 * 60 * 60 * 1000)
}

function allAmounts(row: SaleRecord): Record<Currency, SaleAmounts[Currency]> {
  return {
    USD: {
      subtotal: Number(row.subtotalUsd),
      discount: Number(row.discountUsd),
      iva: Number(row.ivaUsd),
      total: Number(row.totalUsd),
    },
    EUR: {
      subtotal: Number(row.subtotalEur),
      discount: Number(row.discountEur),
      iva: Number(row.ivaEur),
      total: Number(row.totalEur),
    },
    VES: {
      subtotal: Number(row.subtotalVes),
      discount: Number(row.discountVes),
      iva: Number(row.ivaVes),
      total: Number(row.totalVes),
    },
  }
}

function visibleAmounts(row: SaleRecord, isAdmin: boolean): SaleAmounts {
  const all = allAmounts(row)

  if (isAdmin) return all

  // El aliado ve su moneda base + VES. El EUR solo se muestra si es su base.
  const result: SaleAmounts = { VES: all.VES }
  if (row.currency !== 'VES') result[row.currency] = all[row.currency]
  return result
}

function serializeSale(row: SaleRecord, isAdmin: boolean): Sale {
  const canSeeEur = isAdmin || row.currency === 'EUR'

  return {
    id: row.id,
    partnerId: row.partnerId,
    partnerName: row.partnerName,
    partnerRif: row.partnerRif,
    channelId: row.channelId,
    channelName: row.channelName,
    currency: row.currency,
    usdRate: Number(row.usdRate),
    eurRate: canSeeEur ? Number(row.eurRate) : null,
    rateDate: row.rateDate,
    rateSource: row.rateSource,
    amounts: visibleAmounts(row, isAdmin),
    discountType: row.discountType,
    discountValue: Number(row.discountValue),
    soldAt: row.soldAt.toISOString(),
    status: row.status,
    paymentStatus: row.paymentStatus,
    notes: row.notes,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancelledBy: row.cancelledBy,
    cancelledByName: row.cancelledByName,
    cancelReason: row.cancelReason,
  }
}

function serializeSaleItem(row: SaleItemRecord): SaleItem {
  return {
    id: row.id,
    productId: row.productId,
    sku: row.sku,
    name: row.name,
    type: row.type,
    quantity: row.quantity,
    unitPrice: Number(row.unitPrice),
    subtotal: Number(row.subtotal),
    discount: Number(row.discount),
    ivaEnabled: row.ivaEnabled,
    ivaRate: Number(row.ivaRate),
    iva: Number(row.iva),
    total: Number(row.total),
    subtotalVes: Number(row.subtotalVes),
    discountVes: Number(row.discountVes),
    ivaVes: Number(row.ivaVes),
    totalVes: Number(row.totalVes),
    position: row.position,
  }
}

function serializeSalePayment(row: SalePaymentRecord, canSeeEur: boolean): SalePayment {
  return {
    id: row.id,
    currency: row.currency,
    amount: Number(row.amount),
    amountVes: Number(row.amountVes),
    usdRate: Number(row.usdRate),
    eurRate: canSeeEur ? Number(row.eurRate) : null,
    rateDate: row.rateDate,
    method: row.method,
    reference: row.reference,
    paidAt: row.paidAt.toISOString(),
    status: row.status,
    notes: row.notes,
    createdBy: row.createdBy,
    createdByName: row.createdByName,
    createdAt: row.createdAt.toISOString(),
    voidedAt: row.voidedAt?.toISOString() ?? null,
    voidedBy: row.voidedBy,
    voidedByName: row.voidedByName,
    voidReason: row.voidReason,
  }
}

async function findSale(db: Db, id: string) {
  const [row] = await db.select().from(sales).where(eq(sales.id, id)).limit(1)
  return row ?? null
}

async function findSaleDetail(c: Context<AppEnv>, id: string): Promise<SaleDetail | null> {
  const db = c.get('db')
  const session = c.get('session')!
  const isAdmin = isAdminSession(session)
  const sale = await findSale(db, id)

  if (!sale) return null

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id))
    .orderBy(saleItems.position)
  const payments = await db
    .select()
    .from(salePayments)
    .where(eq(salePayments.saleId, id))
    .orderBy(salePayments.paidAt)
  const canSeeEur = isAdmin || sale.currency === 'EUR'

  return {
    ...serializeSale(sale, isAdmin),
    items: items.map(serializeSaleItem),
    payments: payments.map((payment) => serializeSalePayment(payment, canSeeEur)),
  }
}

async function resolvePartner(db: Db, partnerId: string) {
  const [row] = await db
    .select({
      id: partners.id,
      name: partners.name,
      rif: partners.rif,
      status: partners.status,
      currency: partners.currency,
      channelId: partners.channelId,
      channelName: channels.name,
      channelStatus: channels.status,
      channelCurrency: channels.currency,
    })
    .from(partners)
    .innerJoin(channels, eq(channels.id, partners.channelId))
    .where(eq(partners.id, partnerId))
    .limit(1)

  return row ?? null
}

async function latestRate(db: Db, businessDate: string) {
  const [row] = await db
    .select({
      date: exchangeRates.date,
      usdRate: exchangeRates.usdRate,
      eurRate: exchangeRates.eurRate,
      source: exchangeRates.source,
    })
    .from(exchangeRates)
    .where(lte(exchangeRates.date, businessDate))
    .orderBy(desc(exchangeRates.date))
    .limit(1)

  return row ?? null
}

salesRoutes.get('/', queryParams(listSalesQuerySchema), async (c) => {
  const { search, partnerId, status, paymentStatus, from, to, page, pageSize } =
    c.req.valid('query')
  const db = c.get('db')
  const session = c.get('session')!
  const isAdmin = isAdminSession(session)
  const conditions: SQL[] = []

  if (isAdmin && partnerId) conditions.push(eq(sales.partnerId, partnerId))
  if (status) conditions.push(eq(sales.status, status))
  if (paymentStatus) conditions.push(eq(sales.paymentStatus, paymentStatus))
  if (from) conditions.push(gte(sales.soldAt, caracasStart(from)))
  if (to) conditions.push(lt(sales.soldAt, caracasNextDay(to)))

  if (search) {
    const term = `%${search}%`
    conditions.push(or(like(sales.partnerName, term), like(sales.id, term)) as SQL)
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined
  const [totalRow] = await db.select({ total: count() }).from(sales).where(where)
  const total = Number(totalRow?.total ?? 0)

  const rows = await db
    .select()
    .from(sales)
    .where(where)
    .orderBy(desc(sales.soldAt), desc(sales.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize)

  return c.json({
    data: rows.map((row) => serializeSale(row, isAdmin)),
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  })
})

salesRoutes.get('/partners', async (c) => {
  // El wrapper de tenancy limita automáticamente a los aliados a su propio
  // registro. El admin ve todos los aliados activos.
  const rows = await c
    .get('db')
    .select({
      id: partners.id,
      name: partners.name,
      type: partners.type,
      currency: partners.currency,
      channelId: partners.channelId,
      channelName: channels.name,
      contactPhone: partners.contactPhone,
    })
    .from(partners)
    .innerJoin(channels, eq(channels.id, partners.channelId))
    .where(eq(partners.status, 'active'))
    .orderBy(partners.name)

  return c.json({ data: rows })
})

salesRoutes.get('/rates', async (c) => {
  const session = c.get('session')!
  const db = c.get('db')
  const isGlobal = isGlobalRole(session.user.role)
  let canSeeEur = isGlobal

  if (!canSeeEur && session.user.partnerId) {
    const [partner] = await db
      .select({ currency: partners.currency })
      .from(partners)
      .where(eq(partners.id, session.user.partnerId))
      .limit(1)
    canSeeEur = partner?.currency === 'EUR'
  }

  const rate = await latestRate(db, toBusinessDate(new Date()))

  if (!rate) {
    throw new AppError(
      409,
      'EXCHANGE_RATE_NOT_FOUND',
      'No hay tasa BCV registrada para hoy ni para una fecha anterior.',
    )
  }

  return c.json({
    data: {
      date: rate.date,
      usdRate: Number(rate.usdRate),
      eurRate: canSeeEur ? Number(rate.eurRate) : null,
      source: rate.source,
    },
  })
})

salesRoutes.get('/:id', async (c) => {
  const detail = await findSaleDetail(c, c.req.param('id'))

  if (!detail) throw notFound('No encontramos esta venta.')

  return c.json({ data: detail })
})

salesRoutes.post('/', jsonBody(createSaleSchema), async (c) => {
  const session = c.get('session')!
  const body = c.req.valid('json')
  const db = c.get('db')
  const isAdmin = isAdminSession(session)

  let partnerId: string
  if (isPartnerRole(session.user.role)) {
    if (!session.user.partnerId) {
      throw forbidden('Tu usuario no está asociado a un aliado.')
    }
    if (body.partnerId && body.partnerId !== session.user.partnerId) {
      throw forbidden('Solo puedes registrar ventas de tu propio aliado.')
    }
    partnerId = session.user.partnerId
  } else {
    if (!body.partnerId) throw badRequest('Selecciona el aliado de la venta.')
    partnerId = body.partnerId
  }

  const partner = await resolvePartner(db, partnerId)
  if (!partner) throw notFound('No encontramos el aliado de la venta.')
  if (partner.status !== 'active') throw badRequest('El aliado está inactivo.')
  if (partner.channelStatus !== 'active') {
    throw badRequest('El canal de precios del aliado está inactivo.')
  }
  if (partner.currency !== partner.channelCurrency) {
    throw new AppError(
      409,
      'CHANNEL_CURRENCY_MISMATCH',
      `El canal «${partner.channelName}» está en ${partner.channelCurrency}, pero el aliado está en ${partner.currency}. Corrige la configuración antes de vender.`,
      { channelCurrency: partner.channelCurrency, partnerCurrency: partner.currency },
    )
  }

  const soldAt = body.soldAt ?? new Date()
  const rateDate = toBusinessDate(soldAt)
  const rate = await latestRate(db, rateDate)

  if (!rate) {
    throw new AppError(
      409,
      'EXCHANGE_RATE_NOT_FOUND',
      `No hay tasa BCV registrada para el ${rateDate} ni para una fecha anterior.`,
      { date: rateDate },
    )
  }

  // Un mismo producto enviado dos veces se consolida en una sola línea.
  const quantities = new Map<string, number>()
  for (const item of body.items) {
    quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity)
  }
  const productIds = [...quantities.keys()]

  // Solo el admin puede cobrar a mano cuando el canal no tiene precio activo.
  const manualPrices = new Map<string, number>()
  for (const item of body.items) {
    if (item.unitPrice === undefined) continue
    if (!isAdmin) {
      throw forbidden('Solo un administrador puede definir un precio manual en la venta.')
    }

    const current = manualPrices.get(item.productId)
    if (current !== undefined && current !== item.unitPrice) {
      throw badRequest('Un producto tiene dos precios manuales distintos en la misma venta.')
    }
    manualPrices.set(item.productId, item.unitPrice)
  }

  const productRows = await db
    .select({
      id: products.id,
      sku: products.sku,
      name: products.name,
      type: products.type,
      status: products.status,
      ivaEnabled: products.ivaEnabled,
    })
    .from(products)
    .where(inArray(products.id, productIds))
  const productById = new Map(productRows.map((row) => [row.id, row]))

  if (productById.size !== productIds.length) {
    throw badRequest('Uno de los productos de la venta no existe.')
  }

  const priceRows = await db
    .select({
      productId: channelPrices.productId,
      price: channelPrices.price,
      status: channelPrices.status,
    })
    .from(channelPrices)
    .where(
      and(
        eq(channelPrices.channelId, partner.channelId),
        inArray(channelPrices.productId, productIds),
      ),
    )
  const priceByProduct = new Map(priceRows.map((row) => [row.productId, row]))

  const availabilityRows = await db
    .select({
      productId: productChannels.productId,
      status: productChannels.status,
    })
    .from(productChannels)
    .where(
      and(
        eq(productChannels.channelId, partner.channelId),
        inArray(productChannels.productId, productIds),
      ),
    )
  const availabilityByProduct = new Map(
    availabilityRows.map((row) => [row.productId, row.status]),
  )

  for (const productId of productIds) {
    const product = productById.get(productId)!
    const price = priceByProduct.get(productId)
    const hasActivePrice = Boolean(price && price.status === 'active')

    if (product.status !== 'active') {
      throw badRequest(`El producto ${product.name} está inactivo.`)
    }
    if (availabilityByProduct.get(productId) === 'inactive') {
      throw badRequest(
        `El producto ${product.name} no está activo en el canal ${partner.channelName}.`,
      )
    }
    if (hasActivePrice && manualPrices.has(productId)) {
      throw badRequest(
        `El producto ${product.name} ya tiene un precio activo en el canal. Actualízalo en Catálogo en lugar de enviar un precio manual.`,
      )
    }
    if (!hasActivePrice && !manualPrices.has(productId)) {
      throw new AppError(
        400,
        'PRODUCT_WITHOUT_CHANNEL_PRICE',
        `El producto ${product.name} no tiene un precio activo en el canal del aliado. Un administrador debe indicar un precio manual.`,
        { productId, channelId: partner.channelId },
      )
    }
  }

  const promotionIds = productRows
    .filter((product) => product.type === 'promotion')
    .map((product) => product.id)

  if (promotionIds.length > 0) {
    const components = await db
      .select({
        productId: productComponents.productId,
        componentProductId: productComponents.componentProductId,
        componentName: products.name,
        componentStatus: products.status,
      })
      .from(productComponents)
      .innerJoin(products, eq(products.id, productComponents.componentProductId))
      .where(inArray(productComponents.productId, promotionIds))

    const componentIds = [...new Set(components.map((component) => component.componentProductId))]
    const componentAvailabilityRows =
      componentIds.length > 0
        ? await db
            .select({
              productId: productChannels.productId,
              status: productChannels.status,
            })
            .from(productChannels)
            .where(
              and(
                eq(productChannels.channelId, partner.channelId),
                inArray(productChannels.productId, componentIds),
              ),
            )
        : []
    const componentAvailability = new Map(
      componentAvailabilityRows.map((row) => [row.productId, row.status]),
    )

    for (const promotionId of promotionIds) {
      const own = components.filter((component) => component.productId === promotionId)
      if (own.length === 0) {
        const promotion = productById.get(promotionId)!
        throw badRequest(`La promoción ${promotion.name} no tiene componentes configurados.`)
      }
      const inactive = own.find(
        (component) =>
          component.componentStatus !== 'active' ||
          componentAvailability.get(component.componentProductId) === 'inactive',
      )
      if (inactive) {
        throw badRequest(
          `La promoción incluye el componente ${inactive.componentName}, que no está activo en el canal.`,
        )
      }
    }
  }

  const lines = productIds.map((productId) => {
    const product = productById.get(productId)!
    const price = priceByProduct.get(productId)
    const unitPrice =
      price && price.status === 'active'
        ? Number(price.price)
        : manualPrices.get(productId)!

    return {
      productId,
      sku: product.sku,
      name: product.name,
      type: product.type,
      quantity: quantities.get(productId)!,
      unitPrice,
      ivaEnabled: product.ivaEnabled,
    }
  })

  let calculation
  try {
    calculation = calculateSale({
      currency: partner.currency,
      usdRate: Number(rate.usdRate),
      eurRate: Number(rate.eurRate),
      discountType: body.discountType,
      discountValue: body.discountValue,
      lines,
    })
  } catch (error) {
    throw badRequest(error instanceof Error ? error.message : 'No se pudo calcular la venta.')
  }

  if (!isAdmin && body.payment.currency === 'EUR' && partner.currency !== 'EUR') {
    throw forbidden('No puedes registrar un pago en EUR para esta venta.')
  }

  const paymentAmounts = calculation.amounts[body.payment.currency]
  if (!paymentAmounts) throw badRequest('La moneda del pago no es válida.')

  if (
    body.payment.amount !== undefined &&
    Math.abs(body.payment.amount - paymentAmounts.total) > 0.01
  ) {
    throw badRequest(
      `El monto del pago debe ser ${paymentAmounts.total.toFixed(2)} ${body.payment.currency}.`,
      { expected: paymentAmounts.total },
    )
  }

  const saleId = newId()
  const paidAt = body.payment.paidAt ?? soldAt
  const saleItemValues = calculation.lines.map((line, index) => ({
    id: newId(),
    partnerId,
    saleId,
    productId: line.productId,
    sku: line.sku,
    name: line.name,
    type: line.type,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    subtotal: line.subtotal,
    discount: line.discount,
    ivaEnabled: line.ivaEnabled,
    ivaRate: line.ivaRate,
    iva: line.iva,
    total: line.total,
    subtotalVes: line.subtotalVes,
    discountVes: line.discountVes,
    ivaVes: line.ivaVes,
    totalVes: line.totalVes,
    position: index,
  }))

  const paymentId = newId()
  const paymentValues = {
    id: paymentId,
    partnerId,
    saleId,
    currency: body.payment.currency,
    amount: paymentAmounts.total,
    amountVes: calculation.amounts.VES.total,
    usdRate: Number(rate.usdRate),
    eurRate: Number(rate.eurRate),
    rateDate: rate.date,
    method: body.payment.method,
    reference: nullable(body.payment.reference),
    paidAt,
    status: 'confirmed' as const,
    notes: nullable(body.payment.notes),
    createdBy: session.user.id,
    createdByName: session.user.name,
  }

  const saleValues = {
    id: saleId,
    partnerId,
    partnerName: partner.name,
    partnerRif: partner.rif,
    channelId: partner.channelId,
    channelName: partner.channelName,
    currency: partner.currency,
    usdRate: Number(rate.usdRate),
    eurRate: Number(rate.eurRate),
    rateDate: rate.date,
    rateSource: rate.source,
    subtotalUsd: calculation.amounts.USD.subtotal,
    discountUsd: calculation.amounts.USD.discount,
    ivaUsd: calculation.amounts.USD.iva,
    totalUsd: calculation.amounts.USD.total,
    subtotalEur: calculation.amounts.EUR.subtotal,
    discountEur: calculation.amounts.EUR.discount,
    ivaEur: calculation.amounts.EUR.iva,
    totalEur: calculation.amounts.EUR.total,
    subtotalVes: calculation.amounts.VES.subtotal,
    discountVes: calculation.amounts.VES.discount,
    ivaVes: calculation.amounts.VES.iva,
    totalVes: calculation.amounts.VES.total,
    discountType: body.discountType,
    discountValue: body.discountValue,
    soldAt,
    status: 'confirmed' as const,
    paymentStatus: 'paid' as const,
    notes: nullable(body.notes),
    createdBy: session.user.id,
    createdByName: session.user.name,
  }

  await db.batch([
    db.insert(sales).values(saleValues),
    db.insert(saleItems).values(saleItemValues),
    db.insert(salePayments).values(paymentValues),
  ] as never)

  await writeAudit(c, {
    action: 'sales.sale.create',
    entityType: 'sale',
    entityId: saleId,
    partnerId,
    description: `Registró la venta ${saleId} del aliado ${partner.name}.`,
    metadata: {
      currency: partner.currency,
      total: calculation.amounts[partner.currency].total,
      paymentCurrency: body.payment.currency,
      rateDate: rate.date,
    },
  })

  const detail = await findSaleDetail(c, saleId)
  if (!detail) throw new AppError(500, 'SALE_NOT_FOUND', 'La venta se guardó pero no se pudo leer.')

  return c.json({ data: detail }, 201)
})

salesRoutes.post('/:id/cancel', jsonBody(cancelSaleSchema), async (c) => {
  const session = requireAdminSession(c)
  const db = c.get('db')
  const id = c.req.param('id')
  const body = c.req.valid('json')
  const sale = await findSale(db, id)

  if (!sale) throw notFound('No encontramos esta venta.')
  if (sale.status === 'cancelled') throw conflict('Esta venta ya está anulada.')

  const cancelledAt = new Date()
  const reason = nullable(body.reason)

  await db.batch([
    db
      .update(sales)
      .set({
        status: 'cancelled',
        paymentStatus: 'unpaid',
        cancelledAt,
        cancelledBy: session.user.id,
        cancelledByName: session.user.name,
        cancelReason: reason,
        updatedAt: cancelledAt,
      })
      .where(eq(sales.id, id)),
    db
      .update(salePayments)
      .set({
        status: 'voided',
        voidedAt: cancelledAt,
        voidedBy: session.user.id,
        voidedByName: session.user.name,
        voidReason: reason ?? 'Venta anulada',
      })
      .where(and(eq(salePayments.saleId, id), eq(salePayments.status, 'confirmed'))),
  ] as never)

  await writeAudit(c, {
    action: 'sales.sale.cancel',
    entityType: 'sale',
    entityId: id,
    partnerId: sale.partnerId,
    description: `Anuló la venta ${id} del aliado ${sale.partnerName}.`,
    metadata: { reason },
  })

  const detail = await findSaleDetail(c, id)
  if (!detail) throw notFound('No encontramos esta venta.')

  return c.json({ data: detail })
})
