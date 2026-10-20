import type { Context } from 'hono'
import type { AppEnv } from '../env'
import { auditLogs } from '../db/schema'
import { newId } from './ids'

type AuditInput = {
  actorId?: string | null
  partnerId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  description: string
  metadata?: unknown
}

export async function writeAudit(c: Context<AppEnv>, input: AuditInput) {
  const db = c.get('db')
  const session = c.get('session')

  await db.insert(auditLogs).values({
    id: newId(),
    actorId: input.actorId ?? session?.user.id ?? null,
    partnerId: input.partnerId ?? session?.user.partnerId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    description: input.description,
    metadata: input.metadata === undefined ? null : JSON.stringify(input.metadata),
    ipAddress: c.req.header('cf-connecting-ip') ?? null,
    userAgent: c.req.header('user-agent') ?? null,
  })
}
