import { z } from 'zod'
import { paginationSchema, roleSchema } from './common'

export const createInviteSchema = z.object({
  email: z.string().trim().email('Correo inválido').max(160),
  partnerId: z.string().min(1, 'Selecciona un aliado'),
  role: roleSchema,
})

export const acceptInviteSchema = z.object({
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga'),
})

export const setupSchema = z.object({
  token: z.string().min(1, 'El token es obligatorio'),
  name: z.string().trim().min(2, 'Escribe tu nombre').max(120),
  email: z.string().trim().email('Correo inválido').max(160),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(128, 'La contraseña es demasiado larga'),
})

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  role: roleSchema.optional(),
  partnerId: z.string().min(1).nullable().optional(),
})

export const listUsersQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  partnerId: z.string().optional(),
  role: roleSchema.optional(),
  status: z.enum(['active', 'invited', 'suspended']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Mínimo 8 caracteres').max(128),
})

export const listInvitesQuerySchema = paginationSchema.extend({
  status: z.enum(['pending', 'used', 'expired', 'revoked']).optional(),
  partnerId: z.string().optional(),
  search: z.string().trim().max(120).optional(),
})

export type CreateInviteInput = z.infer<typeof createInviteSchema>
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>
export type SetupInput = z.infer<typeof setupSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>

export type UserRow = {
  id: string
  name: string
  email: string
  role: 'admin' | 'partner_admin' | 'partner_operator'
  partnerId: string | null
  partnerName: string | null
  status: 'active' | 'invited' | 'suspended'
  emailVerified: boolean
  banned: boolean
  lastLoginAt: string | null
  createdAt: string
}

export type InviteRow = {
  id: string
  email: string
  partnerId: string
  partnerName: string
  role: 'admin' | 'partner_admin' | 'partner_operator'
  status: 'pending' | 'used' | 'expired' | 'revoked'
  expiresAt: string
  usedAt: string | null
  createdAt: string
  createdByName: string | null
}

export type InvitePreview = {
  email: string
  partnerName: string
  role: 'admin' | 'partner_admin' | 'partner_operator'
  expiresAt: string
}
