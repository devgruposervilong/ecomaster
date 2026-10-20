import { z } from 'zod'

export const ROLES = ['admin', 'partner_admin', 'partner_operator'] as const
export type Role = (typeof ROLES)[number]

export const PARTNER_TYPES = ['permanente', 'bazar'] as const
export type PartnerType = (typeof PARTNER_TYPES)[number]

export const PARTNER_STATUSES = ['active', 'inactive'] as const
export type PartnerStatus = (typeof PARTNER_STATUSES)[number]

export const CURRENCIES = ['USD', 'EUR', 'VES'] as const
export type Currency = (typeof CURRENCIES)[number]

export const USER_STATUSES = ['active', 'invited', 'suspended'] as const
export type UserStatus = (typeof USER_STATUSES)[number]

export const roleSchema = z.enum(ROLES)
export const partnerTypeSchema = z.enum(PARTNER_TYPES)
export const partnerStatusSchema = z.enum(PARTNER_STATUSES)
export const currencySchema = z.enum(CURRENCIES)

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export type Pagination = z.infer<typeof paginationSchema>

export type Paginated<T> = {
  data: T[]
  meta: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}

export type ApiErrorBody = {
  error: {
    code: string
    message: string
    details?: unknown
  }
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  partner_admin: 'Admin. del aliado',
  partner_operator: 'Operador',
}

export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  permanente: 'Permanente',
  bazar: 'Bazar / eventual',
}

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: 'Dólar (USD)',
  EUR: 'Euro (EUR)',
  VES: 'Bolívar (VES)',
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Activo',
  invited: 'Invitado',
  suspended: 'Suspendido',
}
