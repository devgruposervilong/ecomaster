import { describe, expect, it } from 'vitest'
import { allocateDiscount, calculateSale } from './sales-calculator'

const baseLine = {
  productId: 'p1',
  sku: 'SKU-1',
  name: 'Producto',
  type: 'article' as const,
  quantity: 2,
  unitPrice: 13.5,
  ivaEnabled: true,
}

describe('calculateSale', () => {
  it('calcula una venta en USD y deriva VES y EUR', () => {
    const result = calculateSale({
      currency: 'USD',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'amount',
      discountValue: 1,
      lines: [baseLine],
    })

    expect(result.amounts.USD).toEqual({
      subtotal: 27,
      discount: 1,
      iva: 4.16,
      total: 30.16,
    })
    expect(result.amounts.VES).toEqual({
      subtotal: 985.5,
      discount: 36.5,
      iva: 151.84,
      total: 1100.84,
    })
    expect(result.amounts.EUR).toEqual({
      subtotal: 23.46,
      discount: 0.87,
      iva: 3.62,
      total: 26.21,
    })
    expect(result.lines[0]).toMatchObject({
      subtotal: 27,
      discount: 1,
      iva: 4.16,
      total: 30.16,
      subtotalVes: 985.5,
      discountVes: 36.5,
      ivaVes: 151.84,
      totalVes: 1100.84,
    })
  })

  it('calcula una venta en EUR y deriva VES y USD', () => {
    const result = calculateSale({
      currency: 'EUR',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'none',
      discountValue: 0,
      lines: [{ ...baseLine, quantity: 1, unitPrice: 10 }],
    })

    expect(result.amounts.EUR).toEqual({ subtotal: 10, discount: 0, iva: 1.6, total: 11.6 })
    expect(result.amounts.VES).toEqual({ subtotal: 420, discount: 0, iva: 67.2, total: 487.2 })
    expect(result.amounts.USD).toEqual({ subtotal: 11.51, discount: 0, iva: 1.84, total: 13.35 })
  })

  it('calcula una venta en VES y deriva USD y EUR', () => {
    const result = calculateSale({
      currency: 'VES',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'none',
      discountValue: 0,
      lines: [{ ...baseLine, quantity: 1, unitPrice: 365 }],
    })

    expect(result.amounts.VES).toEqual({ subtotal: 365, discount: 0, iva: 58.4, total: 423.4 })
    expect(result.amounts.USD).toEqual({ subtotal: 10, discount: 0, iva: 1.6, total: 11.6 })
    expect(result.amounts.EUR).toEqual({ subtotal: 8.69, discount: 0, iva: 1.39, total: 10.08 })
  })

  it('no cobra IVA en productos exentos', () => {
    const result = calculateSale({
      currency: 'USD',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'none',
      discountValue: 0,
      lines: [{ ...baseLine, ivaEnabled: false }],
    })

    expect(result.amounts.USD.iva).toBe(0)
    expect(result.amounts.USD.total).toBe(27)
    expect(result.amounts.VES.total).toBe(985.5)
  })

  it('aplica un descuento porcentual antes del IVA', () => {
    const result = calculateSale({
      currency: 'USD',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'percent',
      discountValue: 10,
      lines: [{ ...baseLine, quantity: 1, unitPrice: 100 }],
    })

    expect(result.amounts.USD).toEqual({ subtotal: 100, discount: 10, iva: 14.4, total: 104.4 })
  })

  it('reparte el descuento global entre varias líneas sin perder centavos', () => {
    const result = calculateSale({
      currency: 'USD',
      usdRate: 36.5,
      eurRate: 42,
      discountType: 'amount',
      discountValue: 1,
      lines: [
        { ...baseLine, productId: 'p1', quantity: 1, unitPrice: 1 },
        { ...baseLine, productId: 'p2', quantity: 1, unitPrice: 1 },
        { ...baseLine, productId: 'p3', quantity: 1, unitPrice: 1 },
      ],
    })

    expect(result.lines.map((line) => line.discount)).toEqual([0.34, 0.33, 0.33])
    expect(result.amounts.USD.discount).toBe(1)
    // El IVA se redondea por línea y luego se suma: 0.11 + 0.11 + 0.11.
    expect(result.amounts.USD.total).toBe(2.33)
  })

  it('rechaza un descuento mayor al subtotal', () => {
    expect(() =>
      calculateSale({
        currency: 'USD',
        usdRate: 36.5,
        eurRate: 42,
        discountType: 'amount',
        discountValue: 28,
        lines: [baseLine],
      }),
    ).toThrow(/descuento/i)
  })

  it('rechaza tasas inválidas', () => {
    expect(() =>
      calculateSale({
        currency: 'USD',
        usdRate: 0,
        eurRate: 42,
        discountType: 'none',
        discountValue: 0,
        lines: [baseLine],
      }),
    ).toThrow(/tasa USD/i)
  })
})

describe('allocateDiscount', () => {
  it('devuelve ceros cuando no hay descuento', () => {
    expect(allocateDiscount([100, 200], 0)).toEqual([0, 0])
  })

  it('reparte por mayor resto', () => {
    expect(allocateDiscount([100, 100, 100], 100)).toEqual([34, 33, 33])
    expect(allocateDiscount([100, 100], 1)).toEqual([1, 0])
  })
})
