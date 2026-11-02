import { describe, expect, it } from 'vitest'
import { extractWinkEventMetadata } from './payload'

describe('extractWinkEventMetadata', () => {
  it('extrae el evento, la venta externa y la fecha de actualización', () => {
    const metadata = extractWinkEventMetadata({
      event: 'new_sale',
      data: {
        id: 286,
        updatedAt: '2026-05-04T09:42:00.000Z',
      },
    })

    expect(metadata).toEqual({
      event: 'new_sale',
      externalSaleId: '286',
      externalUpdatedAt: new Date('2026-05-04T09:42:00.000Z'),
      valid: true,
      error: null,
    })
  })

  it('acepta un id de venta en texto', () => {
    const metadata = extractWinkEventMetadata({
      event: 'sale_update',
      data: { id: '286' },
    })

    expect(metadata.externalSaleId).toBe('286')
    expect(metadata.valid).toBe(true)
  })

  it('marca inválido si falta el evento', () => {
    const metadata = extractWinkEventMetadata({ data: { id: 286 } })

    expect(metadata).toMatchObject({
      event: 'unknown',
      externalSaleId: '286',
      valid: false,
    })
    expect(metadata.error).toMatch(/event/)
  })

  it('marca inválido si falta data.id', () => {
    const metadata = extractWinkEventMetadata({ event: 'new_sale', data: {} })

    expect(metadata).toMatchObject({
      event: 'new_sale',
      externalSaleId: null,
      valid: false,
    })
    expect(metadata.error).toMatch(/data\.id/)
  })

  it('marca inválido un payload que no es un objeto', () => {
    const metadata = extractWinkEventMetadata(['no', 'es', 'un', 'objeto'])

    expect(metadata).toMatchObject({
      event: 'unknown',
      externalSaleId: null,
      externalUpdatedAt: null,
      valid: false,
    })
  })

  it('deja la fecha en null si no se puede interpretar', () => {
    const metadata = extractWinkEventMetadata({
      event: 'new_sale',
      data: { id: 286, updatedAt: 'no-es-una-fecha' },
    })

    expect(metadata.valid).toBe(true)
    expect(metadata.externalUpdatedAt).toBeNull()
  })
})
