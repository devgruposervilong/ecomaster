import { zValidator } from '@hono/zod-validator'
import type { ZodType } from 'zod'

export function jsonBody<T extends ZodType>(schema: T) {
  return zValidator('json', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: result.error.issues[0]?.message ?? 'Revisa los datos enviados.',
            details: result.error.issues,
          },
        },
        400,
      )
    }
  })
}

export function queryParams<T extends ZodType>(schema: T) {
  return zValidator('query', schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Revisa los filtros enviados.',
            details: result.error.issues,
          },
        },
        400,
      )
    }
  })
}
