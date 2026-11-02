import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { admin } from 'better-auth/plugins'
import type { AppEnv } from '../env'
import { createDb } from '../db'
import * as schema from '../db/schema'
import { newId } from '../lib/ids'

export function createAuth(env: AppEnv['Bindings']) {
  const db = createDb(env.DB)
  const baseURL = env.BETTER_AUTH_URL || env.APP_URL || undefined

  return betterAuth({
    appName: 'Eco Master Backoffice',
    ...(baseURL ? { baseURL } : {}),
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL, env.BETTER_AUTH_URL].filter(Boolean),
    database: drizzleAdapter(db, {
      provider: 'sqlite',
      schema,
    }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
    },
    user: {
      additionalFields: {
        partnerId: {
          type: 'string',
          required: false,
          input: false,
          returned: true,
        },
        moduleAccess: {
          type: 'string',
          required: false,
          input: false,
          returned: true,
        },
      },
    },
    plugins: [
      admin({
        defaultRole: 'partner_collaborator',
        adminRoles: ['admin'],
      }),
    ],
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
    },
    advanced: {
      database: {
        generateId: () => newId(),
      },
    },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 120,
    },
  })
}
