import type { Db } from './db'

export type SessionUser = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: Date
  updatedAt: Date
  role?: string | null
  banned?: boolean | null
  banReason?: string | null
  banExpires?: Date | null
  partnerId?: string | null
}

export type AuthSession = {
  session: {
    id: string
    token: string
    userId: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
    ipAddress?: string | null
    userAgent?: string | null
    impersonatedBy?: string | null
  }
  user: SessionUser
}

export type AppEnv = {
  Bindings: {
    DB: D1Database
    APP_ENV: string
    APP_URL: string
    BETTER_AUTH_URL: string
    BETTER_AUTH_SECRET: string
    SETUP_TOKEN: string
  }
  Variables: {
    db: Db
    session: AuthSession | null
  }
}
