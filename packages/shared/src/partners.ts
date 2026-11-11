import { z } from 'zod'
import { currencySchema, partnerStatusSchema, partnerTypeSchema, paginationSchema } from './common'

export const partnerContactSchema = z.object({
  name: z.string().trim().max(120).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z.string().trim().email('Correo inválido').max(160).optional().or(z.literal('')),
})

export const createPartnerSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es obligatorio').max(120),
  alias: z
    .string()
    .trim()
    .max(60, 'El alias no puede superar 60 caracteres')
    .optional()
    .or(z.literal('')),
  rif: z
    .string()
    .trim()
    .max(20, 'El RIF no puede superar 20 caracteres')
    .optional()
    .or(z.literal('')),
  type: partnerTypeSchema,
  currency: currencySchema,
  channelId: z.string().trim().min(1, 'Selecciona un canal de precios'),
  profitWarehouseCode: z.string().trim().max(60).optional().or(z.literal('')),
  contactName: z.string().trim().max(120).optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  contactEmail: z.string().trim().email('Correo inválido').max(160).optional().or(z.literal('')),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
})

export const updatePartnerSchema = createPartnerSchema.partial().extend({
  status: partnerStatusSchema.optional(),
})

export const listPartnersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(120).optional(),
  status: partnerStatusSchema.optional(),
  type: partnerTypeSchema.optional(),
})

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>

export type Partner = {
  id: string
  name: string
  alias: string | null
  rif: string | null
  slug: string
  type: 'permanente' | 'bazar'
  currency: 'USD' | 'EUR' | 'VES'
  channelId: string
  channelName: string
  status: 'active' | 'inactive'
  profitWarehouseCode: string | null
  contactName: string | null
  contactPhone: string | null
  contactEmail: string | null
  notes: string | null
  userCount: number
  createdAt: string
  updatedAt: string
}
