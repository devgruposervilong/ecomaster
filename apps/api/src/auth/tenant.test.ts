import { describe, expect, it } from 'vitest'
import type { AuthSession } from '../env'
import { resolveTenantScope } from './tenant'

function session(role: string | null, partnerId: string | null): AuthSession {
  return {
    session: {
      id: 'session',
      token: 'token',
      userId: 'user',
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    user: {
      id: 'user',
      name: 'User',
      email: 'user@example.com',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role,
      partnerId,
    },
  }
}

describe('resolveTenantScope', () => {
  it('da scope admin al rol admin', () => {
    expect(resolveTenantScope('/api/admin/users', session('admin', null))).toEqual({
      kind: 'admin',
    })
  })

  it('da scope partner al usuario con aliado', () => {
    expect(resolveTenantScope('/api/dashboard/summary', session('partner_admin', 'pa'))).toEqual({
      kind: 'partner',
      partnerId: 'pa',
    })
  })

  it('da scope global al colaborador sin aliado', () => {
    expect(resolveTenantScope('/api/dashboard/summary', session('collaborator', null))).toEqual({
      kind: 'admin',
    })
  })

  it('falla cerrado si un rol de aliado no tiene aliado', () => {
    expect(
      resolveTenantScope('/api/dashboard/summary', session('partner_collaborator', null)),
    ).toEqual({ kind: 'deny' })
  })

  it('permite setup e invitaciones públicas como sistema', () => {
    expect(resolveTenantScope('/api/setup', null)).toEqual({
      kind: 'system',
      reason: 'setup',
    })
    expect(resolveTenantScope('/api/setup/status', null)).toEqual({
      kind: 'system',
      reason: 'setup',
    })
    expect(resolveTenantScope('/api/invites/token', null)).toEqual({
      kind: 'system',
      reason: 'invite-accept',
    })
  })

  it('permite el webhook de Wink como sistema', () => {
    expect(resolveTenantScope('/api/webhooks/wink', null)).toEqual({
      kind: 'system',
      reason: 'wink-webhook',
    })
    expect(resolveTenantScope('/api/webhooks-extra', null)).toEqual({ kind: 'deny' })
  })

  it('no confunde las invitaciones admin con las públicas', () => {
    expect(resolveTenantScope('/api/admin/invites', null)).toEqual({ kind: 'deny' })
    expect(resolveTenantScope('/api/invites-extra', null)).toEqual({ kind: 'deny' })
  })

  it('falla cerrado para requests anónimos fuera de las rutas públicas', () => {
    expect(resolveTenantScope('/api/dashboard/summary', null)).toEqual({ kind: 'deny' })
  })
})
