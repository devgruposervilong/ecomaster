import type { CatalogProduct, Currency, CurrencyAmounts, DiscountType } from '@ecomaster/shared'

export type PreviewAmounts = Record<Currency, CurrencyAmounts>

/** Un producto se puede cobrar si el canal tiene un precio activo para él. */
export function hasActivePrice(product: CatalogProduct) {
  return product.price !== null && product.priceStatus === 'active'
}

export type PreviewLine = {
  price: number
  quantity: number
  ivaEnabled: boolean
}

function toCents(value: number) {
  return Math.round(value * 100)
}

function fromCents(cents: number) {
  return Math.round(cents) / 100
}

function allocate(subtotals: number[], discountCents: number) {
  const total = subtotals.reduce((sum, value) => sum + value, 0)
  if (discountCents === 0 || total === 0) return subtotals.map(() => 0)

  const allocations = subtotals.map((subtotal) => {
    const exact = (discountCents * subtotal) / total
    const floor = Math.floor(exact)
    return { floor, remainder: exact - floor }
  })
  let remaining = discountCents - allocations.reduce((sum, item) => sum + item.floor, 0)
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
  return result
}

/**
 * Reproduce en el cliente el cálculo que hace el servidor al registrar la
 * venta, para mostrar los totales mientras se arma la cuenta.
 */
export function calculatePreview({
  currency,
  usdRate,
  eurRate,
  lines,
  discountType,
  discountValue,
}: {
  currency: Currency
  usdRate: number
  eurRate: number
  lines: PreviewLine[]
  discountType: DiscountType
  discountValue: number
}): PreviewAmounts | null {
  if (lines.length === 0 || usdRate <= 0 || eurRate <= 0) return null

  const lineCents = lines.map((line) => ({
    subtotal: toCents(line.price) * line.quantity,
    ivaEnabled: line.ivaEnabled,
  }))
  const subtotalCents = lineCents.reduce((sum, line) => sum + line.subtotal, 0)
  let discountCents = 0

  if (discountType === 'amount') {
    discountCents = Math.min(toCents(discountValue), subtotalCents)
  } else if (discountType === 'percent') {
    const percent = Math.min(Math.max(discountValue, 0), 100)
    discountCents = Math.round((subtotalCents * percent) / 100)
  }

  const discounts = allocate(
    lineCents.map((line) => line.subtotal),
    discountCents,
  )
  const vesRate = currency === 'USD' ? usdRate : currency === 'EUR' ? eurRate : 1
  let subtotal = 0
  let discount = 0
  let iva = 0
  let total = 0
  let subtotalVes = 0
  let discountVes = 0
  let totalVes = 0

  lineCents.forEach((line, index) => {
    const lineDiscount = discounts[index] ?? 0
    const net = line.subtotal - lineDiscount
    const lineIva = line.ivaEnabled ? Math.round(net * 0.16) : 0
    const lineTotal = net + lineIva
    const lineVes = Math.round(lineTotal * vesRate)

    subtotal += line.subtotal
    discount += lineDiscount
    iva += lineIva
    total += lineTotal
    subtotalVes += Math.round(line.subtotal * vesRate)
    discountVes += Math.round(lineDiscount * vesRate)
    totalVes += lineVes
  })

  const base: CurrencyAmounts = {
    subtotal: fromCents(subtotal),
    discount: fromCents(discount),
    iva: fromCents(iva),
    total: fromCents(total),
  }
  const ves: CurrencyAmounts = {
    subtotal: fromCents(subtotalVes),
    discount: fromCents(discountVes),
    iva: fromCents(totalVes - subtotalVes + discountVes),
    total: fromCents(totalVes),
  }
  const third = (rate: number): CurrencyAmounts => {
    const thirdSubtotal = Math.round(subtotalVes / rate)
    const thirdDiscount = Math.round(discountVes / rate)
    const thirdTotal = Math.round(totalVes / rate)
    return {
      subtotal: fromCents(thirdSubtotal),
      discount: fromCents(thirdDiscount),
      iva: fromCents(thirdTotal - thirdSubtotal + thirdDiscount),
      total: fromCents(thirdTotal),
    }
  }

  return {
    USD: currency === 'USD' ? base : third(usdRate),
    EUR: currency === 'EUR' ? base : third(eurRate),
    VES: ves,
  }
}

/** Normaliza texto para búsquedas y lecturas de código de barras. */
export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}
