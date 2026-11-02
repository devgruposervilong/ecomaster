import type {
  Currency,
  CurrencyAmounts,
  DiscountType,
  ProductType,
} from '@ecomaster/shared'

export const DEFAULT_IVA_RATE = 0.16

export type SaleCalculationLineInput = {
  productId: string
  sku: string
  name: string
  type: ProductType
  quantity: number
  unitPrice: number
  ivaEnabled: boolean
}

export type SaleCalculationInput = {
  currency: Currency
  usdRate: number
  eurRate: number
  discountType: DiscountType
  discountValue: number
  ivaRate?: number
  lines: SaleCalculationLineInput[]
}

export type CalculatedSaleLine = SaleCalculationLineInput & {
  unitPrice: number
  subtotal: number
  discount: number
  ivaRate: number
  iva: number
  total: number
  subtotalVes: number
  discountVes: number
  ivaVes: number
  totalVes: number
}

export type CalculatedSale = {
  currency: Currency
  discountType: DiscountType
  discountValue: number
  lines: CalculatedSaleLine[]
  amounts: Record<Currency, CurrencyAmounts>
}

function toCents(value: number) {
  return Math.round(value * 100)
}

function fromCents(cents: number) {
  return Math.round(cents) / 100
}

function assertPositiveRate(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} debe ser mayor a 0`)
  }
}

/**
 * Reparte un descuento en centavos de forma proporcional al subtotal de cada
 * línea, usando el método del mayor resto para que la suma sea exacta.
 */
export function allocateDiscount(subtotals: number[], discountCents: number) {
  const total = subtotals.reduce((sum, value) => sum + value, 0)

  if (discountCents === 0 || total === 0) {
    return subtotals.map(() => 0)
  }

  const allocations = subtotals.map((subtotal) => {
    const exact = (discountCents * subtotal) / total
    const floor = Math.floor(exact)
    return { floor, remainder: exact - floor }
  })

  let assigned = allocations.reduce((sum, item) => sum + item.floor, 0)
  let remaining = discountCents - assigned

  const order = allocations
    .map((item, index) => ({ index, remainder: item.remainder }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index)

  const result = allocations.map((item) => item.floor)

  for (let index = 0; index < order.length && remaining > 0; index += 1) {
    const target = order[index]!
    if (target.remainder > 0 || remaining >= order.length) {
      result[target.index] = (result[target.index] ?? 0) + 1
      remaining -= 1
    }
  }

  // Si por redondeos extremos todavía queda algo, se reparte en orden.
  let cursor = 0
  while (remaining > 0) {
    const position = cursor % result.length
    result[position] = (result[position] ?? 0) + 1
    remaining -= 1
    cursor += 1
  }

  assigned = result.reduce((sum, value) => sum + value, 0)
  if (assigned !== discountCents) {
    throw new Error('No se pudo distribuir el descuento entre las líneas')
  }

  return result
}

function discountCentsFor(
  type: DiscountType,
  value: number,
  subtotalCents: number,
) {
  if (type === 'none') return 0

  if (type === 'percent') {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error('El porcentaje de descuento debe estar entre 0 y 100')
    }
    return Math.round((subtotalCents * value) / 100)
  }

  if (!Number.isFinite(value) || value < 0) {
    throw new Error('El descuento no puede ser negativo')
  }

  const cents = toCents(value)
  if (cents > subtotalCents) {
    throw new Error('El descuento no puede superar el subtotal')
  }
  return cents
}

function rateToVes(currency: Currency, usdRate: number, eurRate: number) {
  if (currency === 'USD') return usdRate
  if (currency === 'EUR') return eurRate
  return 1
}

/**
 * Calcula la venta completa. La moneda de la lista es la fuente de verdad:
 * primero se obtiene VES con la tasa de esa moneda y luego la tercera moneda
 * dividiendo VES entre su tasa. Nunca se cruza directamente USD ↔ EUR.
 */
export function calculateSale(input: SaleCalculationInput): CalculatedSale {
  const { currency, discountType, discountValue } = input

  assertPositiveRate(input.usdRate, 'La tasa USD')
  assertPositiveRate(input.eurRate, 'La tasa EUR')

  if (input.lines.length === 0) {
    throw new Error('La venta debe tener al menos una línea')
  }

  const ivaRate = input.ivaRate ?? DEFAULT_IVA_RATE
  if (!Number.isFinite(ivaRate) || ivaRate < 0 || ivaRate > 1) {
    throw new Error('La tasa de IVA no es válida')
  }
  const ivaBps = Math.round(ivaRate * 10000)

  const linesBase = input.lines.map((line) => {
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error('La cantidad debe ser un entero mayor a 0')
    }
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) {
      throw new Error('El precio unitario no es válido')
    }

    const unitPriceCents = toCents(line.unitPrice)
    const subtotalCents = unitPriceCents * line.quantity

    return {
      ...line,
      unitPriceCents,
      subtotalCents,
    }
  })

  const subtotalCents = linesBase.reduce((sum, line) => sum + line.subtotalCents, 0)
  const totalDiscountCents = discountCentsFor(discountType, discountValue, subtotalCents)
  const discounts = allocateDiscount(
    linesBase.map((line) => line.subtotalCents),
    totalDiscountCents,
  )

  const vesRate = rateToVes(currency, input.usdRate, input.eurRate)

  const lines: CalculatedSaleLine[] = linesBase.map((line, index) => {
    const discountCents = discounts[index] ?? 0
    const netCents = line.subtotalCents - discountCents
    const ivaCents =
      line.ivaEnabled && ivaBps > 0 ? Math.round((netCents * ivaBps) / 10000) : 0
    const totalCents = netCents + ivaCents

    const subtotalVes = Math.round(line.subtotalCents * vesRate)
    const discountVes = Math.round(discountCents * vesRate)
    const totalVes = Math.round(totalCents * vesRate)
    const ivaVes = totalVes - subtotalVes + discountVes

    return {
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      type: line.type,
      quantity: line.quantity,
      unitPrice: fromCents(line.unitPriceCents),
      subtotal: fromCents(line.subtotalCents),
      discount: fromCents(discountCents),
      ivaEnabled: line.ivaEnabled,
      ivaRate,
      iva: fromCents(ivaCents),
      total: fromCents(totalCents),
      subtotalVes: fromCents(subtotalVes),
      discountVes: fromCents(discountVes),
      ivaVes: fromCents(ivaVes),
      totalVes: fromCents(totalVes),
    }
  })

  const sums = lines.reduce(
    (acc, line) => ({
      subtotal: acc.subtotal + toCents(line.subtotal),
      discount: acc.discount + toCents(line.discount),
      iva: acc.iva + toCents(line.iva),
      total: acc.total + toCents(line.total),
      subtotalVes: acc.subtotalVes + toCents(line.subtotalVes),
      discountVes: acc.discountVes + toCents(line.discountVes),
      ivaVes: acc.ivaVes + toCents(line.ivaVes),
      totalVes: acc.totalVes + toCents(line.totalVes),
    }),
    {
      subtotal: 0,
      discount: 0,
      iva: 0,
      total: 0,
      subtotalVes: 0,
      discountVes: 0,
      ivaVes: 0,
      totalVes: 0,
    },
  )

  const baseAmounts: CurrencyAmounts = {
    subtotal: fromCents(sums.subtotal),
    discount: fromCents(sums.discount),
    iva: fromCents(sums.iva),
    total: fromCents(sums.total),
  }
  const vesAmounts: CurrencyAmounts = {
    subtotal: fromCents(sums.subtotalVes),
    discount: fromCents(sums.discountVes),
    iva: fromCents(sums.ivaVes),
    total: fromCents(sums.totalVes),
  }

  const deriveFromVes = (thirdRate: number): CurrencyAmounts => {
    const subtotal = Math.round(sums.subtotalVes / thirdRate)
    const discount = Math.round(sums.discountVes / thirdRate)
    const total = Math.round(sums.totalVes / thirdRate)
    const iva = total - subtotal + discount

    return {
      subtotal: fromCents(subtotal),
      discount: fromCents(discount),
      iva: fromCents(iva),
      total: fromCents(total),
    }
  }

  const amounts: Record<Currency, CurrencyAmounts> = {
    USD: baseAmounts,
    EUR: baseAmounts,
    VES: vesAmounts,
  }

  if (currency === 'USD') {
    amounts.EUR = deriveFromVes(input.eurRate)
  } else if (currency === 'EUR') {
    amounts.USD = deriveFromVes(input.usdRate)
  } else {
    amounts.USD = deriveFromVes(input.usdRate)
    amounts.EUR = deriveFromVes(input.eurRate)
  }

  return {
    currency,
    discountType,
    discountValue,
    lines,
    amounts,
  }
}
